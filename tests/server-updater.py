import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('server_update', Path(__file__).resolve().parents[1] / 'deploy/server/update.py')
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class ServerUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.public = self.base / 'public'
        (self.public / 'releases').mkdir(parents=True)
        (self.public / 'assets').mkdir()
        self.cfg = {'data_root': str(self.base), 'site_host': 'knowledge.example.com', 'keep_releases': 2}

    def release(self, sha, resource='page.a.js', body='version-a'):
        path = self.public / 'releases' / sha
        path.mkdir()
        for name, content in [('index.html', 'home'), ('404.html', 'missing'), ('hashmap.json', '{}'), ('assets/' + resource, body)]:
            file = path / name
            file.parent.mkdir(exist_ok=True)
            file.write_text(content)
        return path

    def test_login_page_200_and_offsite_redirect_do_not_pass_anonymous_probe(self):
        for status, location in [(200, ''), (404, ''), (302, 'https://example.com/auth/'),
                                 (302, 'http://knowledge.example.com/auth/'), (302, '/public/')]:
            self.assertFalse(updater.accepted_response(self.cfg['site_host'], status, location))
        for status, location in [(401, ''), (403, ''), (302, '/auth/?rd=example'),
                                 (303, 'https://knowledge.example.com/auth/')]:
            self.assertTrue(updater.accepted_response(self.cfg['site_host'], status, location))

    def test_probe_discovers_published_notes_and_search_index(self):
        release = self.release('a' * 40)
        note = release / 'docs/skills/SK-432.html'
        note.parent.mkdir(parents=True)
        note.write_text('Example note')
        index = release / 'assets/chunks/@localSearchIndexroot.test.js'
        index.parent.mkdir()
        index.write_text('Example index')
        self.assertEqual(updater.protected_paths(release), [
            '/', '/hashmap.json', '/docs/skills/SK-432.html',
            '/assets/page.a.js', '/assets/chunks/@localSearchIndexroot.test.js',
        ])
        translated = release / 'en/docs/skills/SK-432.html'
        translated.parent.mkdir(parents=True)
        translated.write_text('English example')
        (release / 'en/index.html').write_text('English home')
        (index.parent / '@localSearchIndexen.test.js').write_text('English search')
        updater.validate_output(release)
        self.assertEqual(updater.protected_paths(release), [
            '/', '/hashmap.json', '/en/', '/docs/skills/SK-432.html',
            '/en/docs/skills/SK-432.html', '/assets/page.a.js',
            '/assets/chunks/@localSearchIndexroot.test.js', '/assets/chunks/@localSearchIndexen.test.js',
        ])
        (release / 'en/docs/runbook.html').write_text('private')
        with self.assertRaises(RuntimeError):
            updater.validate_output(release)


    def test_host_validator_rejects_extra_pages_and_symlink_assets(self):
        release = self.release('a' * 40)
        updater.validate_output(release)
        unexpected = release / 'docs/runbook.html'
        unexpected.parent.mkdir()
        unexpected.write_text('private')
        with self.assertRaises(RuntimeError):
            updater.validate_output(release)
        unexpected.unlink()
        (release / 'assets/linked.js').symlink_to(self.base / 'private')
        with self.assertRaises(RuntimeError):
            updater.validate_output(release)

    def test_asset_collision_prevents_changing_active_release(self):
        old = 'a' * 40
        new = 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, body='different-content-same-name')
        with self.assertRaises(RuntimeError):
            updater.activate(self.cfg, new, check=lambda cfg: None)
        self.assertEqual((self.public / 'current').readlink().name, old)

    def test_preflight_failure_preserves_the_live_version(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        stopped = []
        def failed(cfg):
            raise RuntimeError('authentication unavailable')
        with self.assertRaisesRegex(RuntimeError, '发布前.*停用 Caddy'):
            updater.activate(self.cfg, new, check=failed, stop=lambda cfg: stopped.append(True))
        self.assertEqual((self.public / 'current').readlink().name, old)
        self.assertFalse((self.public / 'assets/page.b.js').exists())
        self.assertEqual(stopped, [True])

    def test_preflight_detecting_anonymous_content_stops_before_copying_resources(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        stopped = []
        with patch.object(updater.request, 'build_opener') as opener:
            response = opener.return_value.open.return_value.__enter__.return_value
            response.code = 200
            response.headers = {}
            with self.assertRaisesRegex(RuntimeError, '发布前.*停用 Caddy'):
                updater.activate(self.cfg, new, stop=lambda cfg: stopped.append(True))
        self.assertEqual((self.public / 'current').readlink().name, old)
        self.assertFalse((self.public / 'assets/page.b.js').exists())
        self.assertEqual(stopped, [True])

    def test_preflight_stop_failure_requires_disabling_the_tunnel(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        stopped = []
        def failed(cfg):
            raise RuntimeError('anonymous check failed')
        def stop_failed(cfg):
            stopped.append(True)
            raise RuntimeError('example private runtime details')
        with self.assertRaisesRegex(RuntimeError, '立即停用 Tunnel') as result:
            updater.activate(self.cfg, new, check=failed, stop=stop_failed)
        self.assertNotIn('example private runtime details', str(result.exception))
        self.assertEqual((self.public / 'current').readlink().name, old)
        self.assertFalse((self.public / 'assets/page.b.js').exists())
        self.assertEqual(stopped, [True])

    def test_successful_activation_checks_before_copying_and_after_switching(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        observed, stopped = [], []
        def checked(cfg):
            observed.append(((self.public / 'current').readlink().name,
                             (self.public / 'assets/page.b.js').exists()))
        updater.activate(self.cfg, new, check=checked, stop=lambda cfg: stopped.append(True))
        self.assertEqual(observed, [(old, False), (new, True)])
        self.assertEqual(stopped, [])

    def test_bootstrap_keeps_the_explicit_closed_ingress_workflow(self):
        sha = 'a' * 40
        self.release(sha)
        def unexpected(cfg):
            self.fail('Bootstrap must not contact an unconfigured public entrypoint')
        updater.activate(self.cfg, sha, bootstrap=True, check=unexpected, stop=unexpected)
        self.assertEqual((self.public / 'current').readlink().name, sha)
        self.assertTrue((self.public / 'assets/page.a.js').exists())

    def test_postflight_failure_restores_pointer_and_stops_content_service(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        calls, stopped = [], []
        def checked(cfg):
            calls.append((self.public / 'current').readlink().name)
            if len(calls) == 2:
                raise RuntimeError('anonymous request returned content')
        with self.assertRaisesRegex(RuntimeError, '停用 Caddy'):
            updater.activate(self.cfg, new, check=checked, stop=lambda cfg: stopped.append(True))
        self.assertEqual(calls, [old, new])
        self.assertEqual((self.public / 'current').readlink().name, old)
        self.assertEqual(stopped, [True])

    def test_postflight_stops_content_even_when_pointer_restoration_fails(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        stopped = []
        def checked(cfg):
            if (self.public / 'current').readlink().name == new:
                raise RuntimeError('anonymous request returned content')
        original_switch = updater.switch
        def switch_with_failed_restore(public, sha):
            if sha == old:
                raise OSError('example private runtime details')
            original_switch(public, sha)
        with patch.object(updater, 'switch', side_effect=switch_with_failed_restore):
            with self.assertRaisesRegex(RuntimeError, '已停用 Caddy.*指针恢复失败'):
                updater.activate(self.cfg, new, check=checked, stop=lambda cfg: stopped.append(True))
        self.assertEqual(stopped, [True])

    def test_postflight_stop_failure_requires_disabling_the_tunnel(self):
        old, new = 'a' * 40, 'b' * 40
        self.release(old)
        updater.activate(self.cfg, old, bootstrap=True)
        self.release(new, resource='page.b.js')
        stopped = []
        def checked(cfg):
            if (self.public / 'current').readlink().name == new:
                raise RuntimeError('anonymous request returned content')
        def stop_failed(cfg):
            stopped.append(True)
            raise RuntimeError('example private runtime details')
        with self.assertRaisesRegex(RuntimeError, '立即停用 Tunnel') as result:
            updater.activate(self.cfg, new, check=checked, stop=stop_failed)
        self.assertNotIn('example private runtime details', str(result.exception))
        self.assertEqual((self.public / 'current').readlink().name, old)
        self.assertEqual(stopped, [True])

    def test_retention_keeps_active_and_recent_resources_addressable(self):
        old, recent, active = 'a' * 40, 'b' * 40, 'c' * 40
        for sha in (old, recent, active):
            self.release(sha, resource='page.' + sha[0] + '.js')
            updater.activate(self.cfg, sha, bootstrap=True)
        updater.prune(self.cfg)
        self.assertFalse((self.public / 'releases' / old).exists())
        self.assertFalse((self.public / 'assets/page.a.js').exists())
        self.assertTrue((self.public / 'assets/page.b.js').exists())
        self.assertTrue((self.public / 'assets/page.c.js').exists())


if __name__ == '__main__':
    unittest.main()
