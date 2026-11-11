import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { readSiteSources, siteBase } from '../scripts/site-policy.mjs'
import { checkSiteOutput } from '../scripts/check-site-output.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'site-policy-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (file, text = '# 示例') => {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return { root, put }
}

test('new notes are included while maintenance and unknown content locations are excluded', t => {
  const { root, put } = fixture(t)
  const pages = ['index.md', 'updates.md', 'docs/个人技能记录清单.md', 'docs/skills/SK-028.md', 'daily/README.md', 'daily/2026-10-14.md', 'en/index.md',
    'en/docs/skill-index.md', 'en/docs/skills/SK-028.md', 'en/daily/2026-10-14.md']
  for (const file of [...pages, 'docs/website.md', 'docs/skills/draft.md', 'daily/draft.md', 'en/docs/runbook.md', 'en/daily/draft.md', 'unexpected[notes]/note.md', 'public/raw.md']) put(file)
  const result = readSiteSources(root)
  assert.deepEqual(result.pages, pages.sort())
  assert.ok(result.exclusions.includes('docs/website.md'))
  assert.ok(result.exclusions.includes('en/docs/runbook.md'))
  assert.ok(result.exclusions.includes('unexpected\\[notes\\]/**'))
})

test('source file embedding and symlinks cannot bypass the page boundary', t => {
  const { root, put } = fixture(t)
  for (const source of ['<!-- @include: ../private.md -->', '<<< ../private.txt']) {
    put('index.md', source)
    assert.throws(() => readSiteSources(root), /嵌入/)
  }
  rmSync(join(root, 'index.md'))
  put('private.md')
  symlinkSync(join(root, 'private.md'), join(root, 'index.md'))
  assert.throws(() => readSiteSources(root), /符号链接/)
})

test('deployment paths reject ambiguous URLs and traversal', () => {
  for (const base of ['/', '/example/', '/example/project/']) assert.equal(siteBase(base), base)
  for (const base of ['', 'example/', '/example', '/../', '/./', '//', '/example/?q=1', '/%2e%2e/', '/example\\/', '/example/#fragment']) {
    assert.throws(() => siteBase(base))
  }
})

function output(t) {
  const result = fixture(t)
  result.put('index.html', '<h1>示例</h1>')
  result.put('404.html', '404')
  result.put('hashmap.json', JSON.stringify({ 'index.md': 'version' }))
  result.put('assets/index.md.version.js', 'export default {}')
  result.put('assets/index.md.version.lean.js', 'export default {}')
  return result
}

test('output validation rejects copied source files, hidden material and source maps', t => {
  for (const file of ['docs/website.html', 'assets/app.js.map', 'notes.md', 'assets/.env.js', 'assets/chunks/.git/config.js']) {
    const { root, put } = output(t)
    assert.doesNotThrow(() => checkSiteOutput(root, ['index.md']))
    put(file)
    assert.throws(() => checkSiteOutput(root, ['index.md']), /未授权|隐藏/)
  }
})

test('output validation rejects missing pages, extra page chunks and modified manifests', t => {
  const { root, put } = output(t)
  put('hashmap.json', JSON.stringify({ 'docs_website.md': 'version' }))
  assert.throws(() => checkSiteOutput(root, ['index.md']), /未授权/)
  put('hashmap.json', JSON.stringify({ 'index.md': 'version' }))
  put('assets/docs_website.md.version.js')
  assert.throws(() => checkSiteOutput(root, ['index.md']), /未授权/)
  rmSync(join(root, 'assets/docs_website.md.version.js'))
  rmSync(join(root, 'assets/index.md.version.lean.js'))
  assert.throws(() => checkSiteOutput(root, ['index.md']), /缺少页面资源/)
  rmSync(join(root, 'index.html'))
  assert.throws(() => checkSiteOutput(root, ['index.md']), /缺少网站页面/)
})

test('output validation rejects symbolic links even when filenames are allowed', t => {
  const { root, put } = output(t)
  put('assets/target.js')
  symlinkSync(join(root, 'assets/target.js'), join(root, 'assets/link.js'))
  assert.throws(() => checkSiteOutput(root, ['index.md']), /符号链接/)
})

test('output validation rejects page bootstraps that need unsafe-eval', t => {
  const { root, put } = output(t)
  put('index.html', '<script>window.__VP_SITE_DATA__=deserializeFunctions({tokenize:"_vp-fn_function(){}"})</script>')
  assert.throws(() => checkSiteOutput(root, ['index.md']), /unsafe-eval/)
  put('index.html', '<p>文档可以讨论 deserializeFunctions()。</p><script>window.__VP_SITE_DATA__={}</script>')
  assert.doesNotThrow(() => checkSiteOutput(root, ['index.md']))
})

test('generated content accepts code examples and rejects executable Markdown', t => {
  const { root, put } = fixture(t)
  const note = 'en/docs/skills/SK-321.md'
  put(note, '# 示例\n\n' + String.fromCharCode(96).repeat(3) + 'html\n<script>example()</script>\n{{ name }}\n' + String.fromCharCode(96).repeat(3))
  assert.doesNotThrow(() => readSiteSources(root))
  for (const source of [
    '<script setup>console.log("example")</script>',
    '<example-component />', '{{ name }}', '&#123;&#123; name }}',
    '---js\n({ title: "示例" })\n---', '![remote](https://example.com/p.png)',
    '> <<< ../private.txt', '~~~html-vue\n{{ name }}\n~~~',
  ]) {
    put(note, source)
    assert.throws(() => readSiteSources(root), /plain Markdown|嵌入/)
  }
})
