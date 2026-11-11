import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createContext, runInContext } from 'node:vm'
import { checkSiteOutput } from '../scripts/check-site-output.mjs'
import { readSiteSources } from '../scripts/site-policy.mjs'
import MiniSearch from 'minisearch'
import { installSearchTokenizer } from '../.vitepress/search.mjs'

const project = fileURLToPath(new URL('../', import.meta.url))

const scenarios = [
  { name: 'Public root', base: '/', provider: '' },
  { name: 'Public repository subpath', base: '/example/', provider: '' },
  { name: 'Authelia root', base: '/', provider: 'authelia' },
]

async function verifyBuild(t, scenario) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'site-build-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const file of ['package.json', 'index.md', 'updates.md', 'scripts']) {
    cpSync(join(project, file), join(root, file), { recursive: true })
  }
  const note = 'SK-432'
  const notes = join(root, 'docs/skills')
  mkdirSync(notes, { recursive: true })
  mkdirSync(join(root, 'daily'))
  writeFileSync(join(root, 'docs/个人技能记录清单.md'), '# 个人技能记录清单\n')
  writeFileSync(join(root, 'daily/README.md'), '# 每日更新\n')
  writeFileSync(join(notes, note + '.md'), [
    '# SK-432｜示例查询', '分类：示例；关键词：查找、行号。',
    '首次记录：2026-01-01；最近补充：2026-01-01；最近复习：2026-01-01',
    '', '使用 grep 查找固定文字并显示行号。', '',
  ].join('\n'))
  const english = join(root, 'en')
  mkdirSync(join(english, 'docs/skills'), { recursive: true })
  mkdirSync(join(english, 'daily'))
  for (const file of ['index.md', 'updates.md']) {
    cpSync(join(project, 'en', file), join(english, file))
  }
  writeFileSync(join(english, 'docs/skill-index.md'), '# Skill index\n')
  writeFileSync(join(english, 'daily/README.md'), '# Daily updates\n')
  writeFileSync(join(english, 'daily/2026-01-01.md'), '# 2026-01-01\n\n- [SK-432](../docs/skills/SK-432.md)\n')
  writeFileSync(join(english, 'docs/skills', note + '.md'), [
    '# SK-432 | Example search', 'Category: Deployment examples | Keywords: grep, fixed strings.',
    'First recorded: 2026-01-01 | Last updated: 2026-01-01 | Last reviewed: 2026-01-01',
    '', 'Use grep to find a literal pattern and print line numbers.', '',
  ].join('\n'))
  mkdirSync(join(root, '.vitepress'))
  for (const file of ['config.mts', 'search.mjs', 'theme']) {
    cpSync(join(project, '.vitepress', file), join(root, '.vitepress', file), { recursive: true })
  }
  symlinkSync(join(project, 'node_modules'), join(root, 'node_modules'), 'dir')
  const marker = 'EXCLUDED_CONTENT_CANARY_847291'
  for (const file of ['private.md', 'raw/session.md', 'unexpected[notes]/note.md', 'docs/website.md', 'docs/skills/draft.md', 'en/private.md', 'en/docs/skills/draft.md', 'en/guide/internal.md', 'public/copied.txt', 'public/copied.js']) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), marker)
  }
  const environment = { ...process.env, SITE_BASE: scenario.base, VITE_SITE_AUTH_PROVIDER: scenario.provider }
  const build = spawnSync(process.execPath, [resolve(project, 'node_modules/vitepress/bin/vitepress.js'), 'build', root], {
    cwd: root,
    env: environment,
    encoding: 'utf8', timeout: 110_000,
  })
  assert.equal(build.status, 0, build.stdout + build.stderr)
  const out = join(root, '.vitepress/dist')
  assert.doesNotThrow(() => checkSiteOutput(out, readSiteSources(root).pages))
  function verify(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) verify(file)
      else assert.equal(readFileSync(file).includes(Buffer.from(marker)), false, `Excluded content appeared in ${entry.name}`)
    }
  }
  verify(out)
  const home = readFileSync(join(out, 'index.html'), 'utf8')
  assert.ok(home.includes(`${scenario.base}assets/`))
  assert.ok(home.includes(`${scenario.base}docs/skills/SK-432.html`))
  const session = home.match(/<a class="session-logout" href="([^"]+)" target="_self"[^>]*>([^<]+)<\/a>/)
  if (scenario.provider === 'authelia') {
    assert.deepEqual(session?.slice(1), ['/auth/', '账号 / 退出'])
  } else {
    assert.equal(session, null)
  }
  const deep = readFileSync(join(out, 'docs/skills/SK-432.html'), 'utf8')
  assert.ok(deep.includes(`${scenario.base}assets/`))
  assert.match(deep, /搜索知识/)
  const enHome = readFileSync(join(out, 'en/index.html'), 'utf8')
  const enDeep = readFileSync(join(out, 'en/docs/skills/SK-432.html'), 'utf8')
  const enUpdates = readFileSync(join(out, 'en/updates.html'), 'utf8')
  assert.match(enHome, /<html lang="en"/)
  assert.match(enHome, /Recent notes/)
  assert.match(enHome, /Deployment examples/)
  assert.ok(enHome.includes('href="' + scenario.base + 'en/docs/skills/SK-432.html"'))
  assert.ok(enUpdates.includes('href="' + scenario.base + 'en/daily/2026-01-01.html"'))
  assert.ok(deep.includes('href="' + scenario.base + 'en/docs/skills/SK-432.html" hreflang="en"'))
  assert.ok(enDeep.includes('href="' + scenario.base + 'docs/skills/SK-432.html" hreflang="zh-CN"'))
  assert.equal(enHome.includes('Account / Sign out'), scenario.provider === 'authelia')

  for (const html of [home, deep, enHome, enDeep]) {
    const icon = html.match(/<link rel="icon" type="image\/svg\+xml" href="([^"]+)"/)
    assert.ok(icon, 'The browser icon should be present')
    const [, href] = icon
    assert.ok(href.startsWith(`${scenario.base}assets/humblepen-icon.`))
    assert.match(href, /\.svg$/)
    assert.equal(html.match(/<img class="brand-icon" src="([^"]+)"/)?.[1], href)
    assert.match(readFileSync(join(out, href.slice(scenario.base.length)), 'utf8'), /viewBox="0 0 64 64"/)
  }
  assert.match(home, /<title id="humblepen-logo-title">烂笔头 · humblepen<\/title>/)
  // Reproduce the gateway's ban on eval/new Function during page bootstrap.
  // A successful static render alone does not prove that Vue can start.
  let clientSearchOptions
  for (const html of [home, deep, enHome, enDeep]) {
    const context = createContext({ window: {} }, { codeGeneration: { strings: false, wasm: false } })
    const metadata = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
      .find(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.includes('window.__VP_SITE_DATA__='))
    assert.ok(metadata, 'Page bootstrap metadata must be present')
    assert.doesNotThrow(() => runInContext(metadata[2], context), 'Page bootstrap must work without unsafe-eval')
    assert.equal(context.window.__VP_SITE_DATA__.lang, 'zh-CN')
    assert.equal(context.window.__VP_SITE_DATA__.locales.en.lang, 'en')
    installSearchTokenizer(context.window.__VP_SITE_DATA__)
    clientSearchOptions = context.window.__VP_SITE_DATA__.themeConfig.search.options.miniSearch
  }
  const chunks = join(out, 'assets/chunks')
  for (const [locale, prefix, queries] of [
    ['root', 'docs/skills/', ['固定文字', 'grep 行号', 'grep']],
    ['en', 'en/docs/skills/', ['literal pattern', 'grep line numbers', 'grep']],
  ]) {
    const searchFile = readdirSync(chunks).find(file => file.startsWith('@localSearchIndex' + locale + '.') && file.endsWith('.js'))
    assert.ok(searchFile, 'The ' + locale + ' search index should be built')
    const { default: serialized } = await import(pathToFileURL(join(chunks, searchFile)).href)
    const search = MiniSearch.loadJSON(serialized, { fields: ['title', 'titles', 'text'], storeFields: ['title', 'titles'], ...clientSearchOptions.options })
    for (const query of queries) {
      const results = search.search(query, clientSearchOptions.searchOptions)
      assert.ok(results.length, 'The ' + locale + ' index should match ' + query)
      assert.ok(results.every(result => result.id.startsWith(scenario.base + prefix)))
    }
  }
}

for (const scenario of scenarios) {
  test(`${scenario.name} build keeps navigation and search while excluding private material`, { timeout: 120_000 }, t => verifyBuild(t, scenario))
}
