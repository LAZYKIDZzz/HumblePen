import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MiniSearch from 'minisearch'
import { parseSkill, readLibrary } from '../scripts/content.mjs'
import { checkContent, checkPrivacy } from '../scripts/check-content.mjs'
import { tokenize } from '../.vitepress/search.mjs'

const note = id => `# ${id}｜示例知识\n\n分类：Linux；关键词：文件。\n\n首次记录：2026-10-13；最近补充：2026-10-13；最近复习：2026-10-13。\n\n**问题：** 怎样恢复已删除文件？\n\n**答案：** 查看文件描述符。\n`

test('new Markdown notes enter the catalogue and daily history automatically', () => {
  const root = mkdtempSync(join(tmpdir(), 'humblepen-'))
  try {
    mkdirSync(join(root, 'docs/skills'), { recursive: true }); mkdirSync(join(root, 'daily'))
    writeFileSync(join(root, 'docs/skills/SK-027.md'), note('SK-027'))
    writeFileSync(join(root, 'daily/2026-10-13.md'), '# 每日记录\n新增 SK-027。部分记录。')
    const result = readLibrary(root)
    assert.equal(result.skills[0].id, 'SK-027')
    assert.equal(result.updates[0].skills[0].id, 'SK-027')
    assert.equal(result.updates[0].partial, true)
    assert.equal(result.skills[0].url, '/docs/skills/SK-027.html')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('malformed metadata and mismatched IDs stop the build', () => {
  assert.throws(() => parseSkill('# 缺少元数据', 'SK-001.md'))
  assert.throws(() => parseSkill(note('SK-001'), 'SK-002.md'))
})

test('search reaches Chinese answer text and mixed English command queries', () => {
  const search = new MiniSearch({ fields: ['title', 'text'], tokenize })
  search.addAll([
    { id: 'mysql', title: '数据库认证', text: '远程仍能使用旧密码，查询 CURRENT_USER()。' },
    { id: 'linux', title: '文件恢复', text: '已删除文件通过文件描述符复制。' },
    { id: 'audio', title: '蓝牙', text: '输入选择内建麦克风。' },
  ])
  const options = { combineWith: 'AND', prefix: true, fuzzy: false }
  assert.equal(search.search('旧密码', options)[0].id, 'mysql')
  assert.equal(search.search('已删除', options)[0].id, 'linux')
  assert.equal(search.search('current_user 旧密码', options)[0].id, 'mysql')
  assert.equal(search.search('麦克风', options)[0].id, 'audio')
  assert.deepEqual(search.search('不存在的关键词', options), [])
})

test('privacy guard rejects credentials and private environments, accepts documentation examples', () => {
  const samples = [
    ['', 'home', 'example-user', 'file'].join('/'),
    ['', 'srv', 'example-directory', 'file'].join('/'),
    ['person', 'company.invalid'].join('@'), [10, 12, 13, 14].join('.'),
    ['https:', '', 'chatgpt.com', 'c', 'example'].join('/'), 'ghp_' + 'a'.repeat(30),
  ]
  for (const source of samples) {
    assert.throws(() => checkPrivacy(source, 'example.md'))
  }
  for (const source of ['`/path/to/file`', 'user@example.com', '192.0.2.10', '127.0.0.1', '[返回](../docs/skills/SK-001.md)', '[官方](https://docs.example.com/guide/)']) {
    assert.doesNotThrow(() => checkPrivacy(source, 'example.md'))
  }
})

test('translated notes share an ID and daily summaries require a note in their own language', t => {
  const root = mkdtempSync(join(tmpdir(), 'humblepen-locales-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'docs/skills'), { recursive: true })
  mkdirSync(join(root, 'en/daily'), { recursive: true })
  mkdirSync(join(root, 'en/docs/skills'), { recursive: true })
  writeFileSync(join(root, 'docs/skills/SK-027.md'), note('SK-027'))
  writeFileSync(join(root, 'en/daily/2026-10-13.md'), '# Daily notes\n\n- [SK-027](../docs/skills/SK-027.md)\n')
  assert.throws(() => checkContent(root), /missing note SK-027 in this language/)
  writeFileSync(join(root, 'en/docs/skills/SK-027.md'), [
    '# SK-027 | Recover an example file',
    'Category: Linux | Keywords: files.',
    'First recorded: 2026-10-13 | Last updated: 2026-10-13 | Last reviewed: 2026-10-13',
  ].join('\n'))
  assert.equal(checkContent(root).notes, 2)
  assert.equal(readLibrary(root, 'en').updates[0].skills[0].url, '/en/docs/skills/SK-027.html')
})
