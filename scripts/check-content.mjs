import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentLocales, contentLocation, readLibrary } from './content.mjs'
import { readSiteSources } from './site-policy.mjs'

export function checkPrivacy(text, file) {
  const rules = [
    ['真实用户目录', 'Actual user directory', /\/(?:Users|home)\/[\w.-]+|(?<![a-z])[a-z]:[\\/]/i],
    ['私人聊天链接', 'Private chat link', /codex:\/\/|chatgpt\.com\/c\//i],
    ['疑似凭据', 'Potential credential', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:github_pat_|gh[pousr]_|sk-(?:proj-)?)\w{12,}/],
    ['内部主机', 'Internal hostname', /\b[\w.-]+\.(?:internal|corp|lan|local)\b/i],
    ['非示例邮箱', 'Email address outside the example domains', /\b[\w.+-]+@(?!example\.(?:com|org|net)\b)[\w.-]+\.[a-z]{2,}\b/i],
    ['真实 home 路径', 'Actual home directory path', /(?<!\w)~\/(?!example(?:\/|\b)|path\/to\/)/],
  ]
  const english = contentLocation(file).locale === 'en'
  for (const [name, label, pattern] of rules) {
    const match = pattern.exec(text)
    if (match) {
      const line = text.slice(0, match.index).split('\n').length
      const message = english ? label + '. Redact it before publishing.' : name + '，请脱敏后发布。'
      throw new Error(file + ':' + line + ': ' + message)
    }
  }
  for (const match of text.matchAll(/(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g)) {
    const octets = match[0].split('.').map(Number)
    if (octets.some(n => n > 255)) continue
    if (octets[0] === 127 || ['192.0.2', '198.51.100', '203.0.113'].includes(octets.slice(0, 3).join('.'))) continue
    throw new Error(file + ': ' + (english ? 'IP address outside the documentation ranges.' : '非文档示例 IP，请脱敏后发布。'))
  }
  for (const match of text.matchAll(/(?<![\w:/.*?])\/(?:[\w.<>-]+\/)*[\w.<>-]+/g)) {
    if (match[0].startsWith('/path/to/') || match[0].startsWith('/example/')) continue
    const prefix = text.slice(Math.max(0, match.index - 100), match.index)
    if (/https?:\/\/[^\s]*$/.test(prefix)) continue
    throw new Error(file + ': ' + (english ? 'Replace the absolute path with an example path.' : '绝对目录应替换为示例路径。'))
  }
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error('内容目录不能包含符号链接。')
    return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : []
  })
}

export function checkContent(root) {
  readSiteSources(root)
  let notes = 0, documents = 0
  for (const [locale, { prefix }] of Object.entries(contentLocales)) {
    const library = readLibrary(root, locale)
    const known = new Set(library.skills.map(skill => skill.id))
    if (known.size !== library.skills.length) throw new Error('Duplicate skill IDs in ' + locale)
    notes += known.size
    const directories = ['docs', 'daily'].map(directory => resolve(root, prefix, directory))
    for (const file of directories.filter(existsSync).flatMap(markdownFiles)) {
      const name = relative(root, file).split(sep).join('/')
      const source = readFileSync(file, 'utf8')
      checkPrivacy(source, name)
      if (contentLocation(name).path.startsWith('daily/')) {
        for (const id of source.match(/SK-\d+/g) || []) {
          if (!known.has(id)) throw new Error(name + ': missing note ' + id + ' in this language.')
        }
      }
      documents += 1
    }
  }
  return { notes, documents }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkContent(process.cwd())
  console.log(`Content check passed / 内容检查通过: ${result.notes} notes / 笔记, ${result.documents} Markdown files. Review the content before publishing. / 发布前请审阅内容。`)
}
