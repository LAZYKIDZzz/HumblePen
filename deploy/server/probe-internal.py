#!/usr/bin/env python3
"""Run in the builder image attached to the isolated entry network."""
import argparse
from urllib import error, parse, request

class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

parser = argparse.ArgumentParser()
parser.add_argument('host')
parser.add_argument('--expect-outage', action='store_true')
parser.add_argument('paths', nargs='*', help='Additional site-relative routes to probe')
args = parser.parse_intermixed_args()
opener = request.build_opener(NoRedirect())
for path in ('/', '/hashmap.json', '/assets/example.js', *args.paths):
    if not path.startswith('/') or path.startswith('//'):
        parser.error('Probe paths must start with a single slash.')
    req = request.Request('http://caddy:8080' + path, headers={
        'Host': args.host,
        'CF-Connecting-IP': '192.0.2.1',
        'Remote-User': 'owner',
        'Remote-Groups': 'readers',
        'Remote-Email': 'user@example.com',
    })
    try:
        response = opener.open(req, timeout=15)
    except error.HTTPError as exc:
        response = exc
    with response:
        location = parse.urlsplit(response.headers.get('Location', ''))
        login = (response.code in (302, 303, 307, 308) and location.scheme == 'https' and
                 location.netloc == args.host and (location.path == '/auth' or location.path.startswith('/auth/')))
        good = response.code in (502, 503, 504) if args.expect_outage else response.code in (401, 403) or login
        if not good:
            raise SystemExit('内部鉴权检查失败；不要配置域名入口。')
print('内部检查通过：伪造身份头不能读取内容。' if not args.expect_outage else '认证服务停止时，内容入口保持拒绝访问。')
