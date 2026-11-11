#!/usr/bin/env python3
"""Ubuntu operator-installed updater. Never run repository code on the host."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib import error, parse, request
import uuid

SHA = re.compile(r'[a-f0-9]{40}')
HOST = re.compile(r'(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}')


def run(args, *, cwd=None, env=None, timeout=180):
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('外部命令失败；请在服务器私有环境中核对依赖、权限和配置。')
    return result.stdout


def read_config(filename):
    path = Path(filename).resolve()
    if path.stat().st_mode & 0o077:
        raise RuntimeError('更新配置必须仅允许管理员读取。')
    cfg = json.loads(path.read_text())
    if not HOST.fullmatch(cfg.get('site_host', '')):
        raise ValueError('请配置完整的站点 hostname。')
    if not re.fullmatch(r'git@github\.com:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git', cfg.get('repository', '')):
        raise ValueError('仓库地址必须是 GitHub 的 SSH 仓库地址。')
    if not re.fullmatch(r'sha256:[a-f0-9]{64}', cfg.get('node_image', '')):
        raise ValueError('请填入已经在服务器构建的 builder image ID。')
    if not re.fullmatch(r'[1-9][0-9]*[mg]', cfg.get('build_memory', '2g')):
        raise ValueError('构建内存限制应使用正整数加 m 或 g。')
    if not isinstance(cfg.get('keep_releases', 5), int) or not 2 <= cfg.get('keep_releases', 5) <= 30:
        raise ValueError('保留版本数量必须在 2 至 30 之间。')
    for key in ('deploy_key', 'known_hosts', 'data_root', 'stack_root'):
        value = Path(cfg[key])
        if not value.is_absolute() or value == Path('/'):
            raise ValueError('运行目录和私有文件必须使用明确的绝对路径。')
        if any(character in str(value) for character in (',', '\n', '\r')):
            raise ValueError('运行路径不能包含逗号或换行。')
        cfg[key] = str(value.resolve())
    if Path(cfg['deploy_key']).stat().st_mode & 0o077:
        raise RuntimeError('Deploy Key 不能允许其他用户读取。')
    return cfg


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def accepted_response(host, status, location):
    if status in (401, 403):
        return True
    if status not in (302, 303, 307, 308) or not location:
        return False
    url = parse.urlsplit(parse.urljoin('https://' + host + '/', location))
    return (url.scheme == 'https' and url.netloc == host and
            (url.path == '/auth' or url.path.startswith('/auth/')))


def protected_paths(current):
    paths = ['/', '/hashmap.json']
    if (current / 'en/index.html').is_file():
        paths.append('/en/')
    for pattern in ('docs/skills/SK-*.html', 'en/docs/skills/SK-*.html',
                    'assets/*.js', 'assets/chunks/@localSearchIndexroot.*.js',
                    'assets/chunks/@localSearchIndexen.*.js'):
        file = next(iter(sorted(current.glob(pattern))), None)
        if file:
            paths.append('/' + file.relative_to(current).as_posix())
    return paths


def probe(cfg):
    host = cfg['site_host']
    current = Path(cfg['data_root']) / 'public/current'
    paths = protected_paths(current)
    opener = request.build_opener(NoRedirect())
    for path in paths:
        req = request.Request('https://' + host + parse.quote(path),
                              headers={'Cache-Control': 'no-store'}, method='GET')
        try:
            response = opener.open(req, timeout=15)
        except error.HTTPError as exc:
            response = exc
        with response:
            if not accepted_response(host, response.code, response.headers.get('Location')):
                raise RuntimeError('匿名请求没有被拒绝或跳转到本站登录入口。')


def validate_output(dist):
    if dist.is_symlink() or not dist.is_dir():
        raise RuntimeError('发布产物目录无效。')
    required = {'index.html', '404.html', 'hashmap.json'}
    found = set()
    for file in dist.rglob('*'):
        name = file.relative_to(dist).as_posix()
        if file.is_symlink() or any(part.startswith('.') for part in file.relative_to(dist).parts):
            raise RuntimeError('发布产物不能有符号链接或隐藏路径。')
        if file.is_dir():
            if name not in ('assets', 'docs', 'docs/skills', 'daily', 'en', 'en/docs', 'en/docs/skills', 'en/daily') and not name.startswith('assets/'):
                raise RuntimeError('发布产物包含额外目录。')
            continue
        if not file.is_file():
            raise RuntimeError('发布产物必须是普通文件。')
        allowed = (name in ('index.html', 'updates.html', '404.html', 'hashmap.json', 'vp-icons.css',
                            'docs/个人技能记录清单.html', 'daily/README.html',
                            'en/index.html', 'en/updates.html', 'en/docs/skill-index.html', 'en/daily/README.html') or
                   re.fullmatch(r'(?:en/)?docs/skills/SK-[0-9]+\.html', name) or
                   re.fullmatch(r'(?:en/)?daily/[0-9]{4}-[0-9]{2}-[0-9]{2}\.html', name) or
                   re.fullmatch(r'assets/.+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)', name))
        if not allowed:
            raise RuntimeError('发布产物包含非网站文件。')
        found.add(name)
    if not required <= found:
        raise RuntimeError('发布产物不完整。')


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').digest() if hasattr(hashlib, 'file_digest') else hashlib.sha256(stream.read()).digest()


def merge_assets(release, public):
    pairs = [(file, public / 'assets' / file.relative_to(release / 'assets'))
             for file in (release / 'assets').rglob('*') if file.is_file()]
    for source, target in pairs:
        if target.is_symlink() or (target.exists() and digest(source) != digest(target)):
            raise RuntimeError('资源文件名发生版本冲突，保留现有发布。')
    for source, target in pairs:
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            target.chmod(0o644)


def switch(public, sha):
    temporary = public / ('.current-' + uuid.uuid4().hex)
    temporary.symlink_to('releases/' + sha)
    os.replace(temporary, public / 'current')


def stop_site(cfg):
    run(['docker', 'compose', 'stop', 'caddy'], cwd=cfg['stack_root'])


def abort_publication(cfg, stop, message):
    try:
        stop(cfg)
    except Exception:
        raise RuntimeError('匿名访问检查失败且 Caddy 未成功停用；请立即停用 Tunnel 域名入口。') from None
    raise RuntimeError(message) from None


def activate(cfg, sha, check=probe, stop=stop_site, bootstrap=False):
    if not SHA.fullmatch(sha):
        raise ValueError('版本必须是完整的 40 位提交编号。')
    public = Path(cfg['data_root']) / 'public'
    release = public / 'releases' / sha
    validate_output(release)
    current = public / 'current'
    previous = None
    if current.exists() or current.is_symlink():
        if not current.is_symlink() or not re.fullmatch(r'releases/[a-f0-9]{40}', str(current.readlink())):
            raise RuntimeError('当前发布指针无效，停止覆盖。')
        previous = current.readlink().name
    if not bootstrap:
        try:
            check(cfg)
        except Exception:
            abort_publication(cfg, stop, '发布前匿名检查失败，未合并新资源或切换版本，已停用 Caddy；修复后手动恢复。')
    # Retained assets are served independently of current; check the entrypoint before copying.
    merge_assets(release, public)
    switch(public, sha)
    if not bootstrap:
        try:
            check(cfg)
        except Exception:
            try:
                if previous:
                    switch(public, previous)
                else:
                    current.unlink(missing_ok=True)
            except Exception:
                abort_publication(cfg, stop, '匿名验收失败，已停用 Caddy，但旧发布指针恢复失败；请检查版本指针后手动恢复。')
            abort_publication(cfg, stop, '匿名验收失败，已恢复原发布指针并停用 Caddy；修复后手动恢复。')


def prune(cfg):
    public = Path(cfg['data_root']) / 'public'
    active = (public / 'current').readlink().name
    releases = sorted((p for p in (public / 'releases').iterdir()
                       if SHA.fullmatch(p.name) and p.is_dir() and not p.is_symlink()),
                      key=lambda p: p.stat().st_mtime, reverse=True)
    keep = {active}
    for release in releases:
        if len(keep) < cfg.get('keep_releases', 5):
            keep.add(release.name)
    for release in releases:
        if release.name not in keep:
            shutil.rmtree(release)
    needed = {file.relative_to(release / 'assets').as_posix()
              for release in releases if release.name in keep
              for file in (release / 'assets').rglob('*') if file.is_file()}
    for file in (public / 'assets').rglob('*'):
        if file.is_file() and file.relative_to(public / 'assets').as_posix() not in needed:
            file.unlink()


def build(cfg, sha, repository):
    base = Path(cfg['data_root'])
    destination = base / 'public/releases' / sha
    if destination.exists():
        validate_output(destination)
        return
    archive = run(['git', '-C', str(repository), 'archive', '--format=tar', sha])
    if len(archive) > 128 * 1024 * 1024:
        raise RuntimeError('源码归档超过本次发布大小限制。')
    with tempfile.TemporaryDirectory(prefix='build-', dir=base / 'work') as directory:
        work = Path(directory)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            for member in tar.getmembers():
                if (Path(member.name).is_absolute() or '..' in Path(member.name).parts or
                        not (member.isfile() or member.isdir())):
                    raise RuntimeError('源码归档包含不安全的路径或链接。')
            tar.extractall(work)
        for file in [work, *work.rglob('*')]:
            os.chown(file, 1000, 1000, follow_symlinks=False)
        container = 'knowledge-build-' + uuid.uuid4().hex
        try:
            run(['docker', 'run', '--rm', '--pull=never', '--name', container,
                 '--user', '1000:1000', '--cap-drop=ALL', '--security-opt=no-new-privileges',
                 '--pids-limit', '512', '--memory', cfg.get('build_memory', '2g'), '--cpus', '2',
                 '--mount', 'type=bind,src=' + str(work) + ',dst=/workspace',
                 '--workdir', '/workspace', '--env', 'npm_config_cache=/tmp/npm-cache',
                 '--env', 'SITE_BASE=/',
                 '--env', 'VITE_SITE_AUTH_PROVIDER=authelia',
                 cfg['node_image'], 'sh', '-ceu',
                 'npm ci && npm run check && npm test && npm run build && npm run check:site'], timeout=900)
        finally:
            subprocess.run(['docker', 'rm', '-f', container], capture_output=True, timeout=30)
        dist = work / '.vitepress/dist'
        validate_output(dist)
        temporary = destination.parent / ('.release-' + uuid.uuid4().hex)
        try:
            shutil.copytree(dist, temporary)
            for file in [temporary, *temporary.rglob('*')]:
                os.chown(file, 0, 0, follow_symlinks=False)
                file.chmod(0o755 if file.is_dir() else 0o644)
            os.replace(temporary, destination)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--bootstrap', action='store_true')
    group.add_argument('--probe', action='store_true')
    group.add_argument('--rollback', metavar='COMMIT_SHA')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('请由服务器管理员运行已审阅的更新程序。')
    os.umask(0o077)
    cfg = read_config(args.config)
    base = Path(cfg['data_root'])
    base.mkdir(parents=True, exist_ok=True)
    for relative in ('work', 'public', 'public/releases', 'public/assets'):
        (base / relative).mkdir(exist_ok=True)
    # Caddy mounts public only; all authentication and source material stays outside.
    for relative in ('public', 'public/releases', 'public/assets'):
        (base / relative).chmod(0o755)
    with (base / 'update.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('已有更新正在执行，本次退出。')
            return
        enabled = base / 'updates-enabled'
        if args.probe:
            probe(cfg)
            print('匿名入口检查通过；真实账号、MFA 和撤销仍须实际验收。')
            return
        if args.rollback:
            if enabled.exists():
                raise RuntimeError('先暂停自动更新，再执行内容回退。')
            activate(cfg, args.rollback)
            print('已恢复保留的历史内容版本；认证设置没有回退。')
            return
        if args.bootstrap and ((base / 'public/current').exists() or (base / 'public/current').is_symlink() or enabled.exists()):
            raise RuntimeError('初始化只适用于尚未发布的封闭环境。')
        if not args.bootstrap and not enabled.exists():
            print('自动更新未启用，本次不发布。')
            return
        env = os.environ.copy()
        env['GIT_TERMINAL_PROMPT'] = '0'
        env['GIT_SSH_COMMAND'] = shlex.join(['ssh', '-i', cfg['deploy_key'], '-o', 'IdentitiesOnly=yes',
                                            '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + cfg['known_hosts']])
        repository = base / 'repo.git'
        if not repository.exists():
            run(['git', 'init', '--bare', str(repository)])
        run(['git', '-C', str(repository), 'fetch', '--depth=1', '--no-tags', cfg['repository'], 'refs/heads/main'], env=env)
        sha = run(['git', '-C', str(repository), 'rev-parse', 'FETCH_HEAD']).decode().strip()
        if not SHA.fullmatch(sha):
            raise RuntimeError('远程提交编号无效。')
        current = base / 'public/current'
        if current.is_symlink() and str(current.readlink()) == 'releases/' + sha:
            print('远程提交与已发布版本一致，无需构建。')
            return
        build(cfg, sha, repository)
        activate(cfg, sha, bootstrap=args.bootstrap)
        if not args.bootstrap:
            prune(cfg)
        print('封闭环境初始化完成；尚未执行公网验收。' if args.bootstrap else '新版本发布和匿名验收通过。')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not disclose credentials, repository output or runtime paths in automated logs.
        print(str(exc) if isinstance(exc, (ValueError, RuntimeError)) else '更新失败；请检查服务器私有配置、网络或资源。', file=sys.stderr)
        sys.exit(1)
