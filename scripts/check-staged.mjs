import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TextDecoder } from 'node:util'
import { checkPrivacy } from './check-content.mjs'
import { checkPlainMarkdown } from './markdown-policy.mjs'
import { contentLocales, contentLocation, parseSkill, skillPage } from './content.mjs'
import { isSearchPage } from './site-policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

function git(...args) {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
}

function check() {
  const changes = git('diff', '--cached', '--no-renames', '--name-status', '-z').toString('utf8').split('\0')
  const index = git('ls-files', '--stage', '-z').toString('utf8').split('\0')
  const modes = new Map(index.filter(Boolean).map(record => {
    const separator = record.indexOf('\t')
    return [record.slice(separator + 1), record.slice(0, 6)]
  }))
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let count = 0
  for (let i = 0; i < changes.length - 1; i += 2) {
    const [status, path] = [changes[i], changes[i + 1]]
    const { locale, path: localizedPath } = contentLocation(path)
    if (!['A', 'M'].includes(status) || (!isSearchPage(path) && localizedPath !== contentLocales[locale].index) || modes.get(path) !== '100644') {
      throw new Error('Unexpected staged path, deletion, or file type. / 暂存区包含非日常 Markdown 更新、删除或特殊文件。')
    }
    const source = decoder.decode(git('show', ':' + path))
    checkPrivacy(source, path)
    checkPlainMarkdown(source, path)
    if (skillPage.test(localizedPath)) parseSkill(source, path.split('/').at(-1), locale)
    count += 1
  }
  if (!count) throw new Error('No staged note updates. / 没有待提交的日常笔记。')
  console.log('Staged check passed / 暂存检查通过: ' + count + ' files. Review the content before pushing publicly. / 公开推送前请审阅内容。')
}

try { check() }
catch (error) {
  console.error(error.status === undefined ? error.message : 'Unable to check the Git index. / 无法检查 Git 暂存区。')
  process.exitCode = 1
}
