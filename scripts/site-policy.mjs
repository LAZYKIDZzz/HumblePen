import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkPlainMarkdown } from './markdown-policy.mjs'
import { contentLocales, contentLocation, dailyPage, skillPage } from './content.mjs'

const containers = new Set(['en', ...Object.values(contentLocales).flatMap(({ prefix }) =>
  ['docs', 'docs/skills', 'daily'].map(directory => prefix + directory))])
const navigation = new Set(['index.md', 'updates.md', 'daily/README.md'])

export function isSiteDirectory(file) {
  return containers.has(file)
}

export function isSitePage(file) {
  const { locale, path } = contentLocation(file)
  return navigation.has(path) || path === contentLocales[locale].index || isSearchPage(file)
}

export function isSearchPage(file) {
  const { path } = contentLocation(file)
  return skillPage.test(path) || dailyPage.test(path)
}

// Exclusions follow allowed content locations, rather than a list of private directories.
export function readSiteSources(root = process.cwd()) {
  const pages = [], exclusions = []
  const escapeGlob = value => value.replace(/[\\*?\[\]{}()!+@]/g, '\\$&')
  function visit(directory = '') {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name
      if (isSiteDirectory(file) || isSitePage(file)) {
        if (entry.isSymbolicLink()) throw new Error(`网站内容不能包含符号链接：${file}`)
        if (isSiteDirectory(file)) {
          if (!entry.isDirectory()) throw new Error(`网站内容目录格式错误：${file}`)
          visit(file)
        } else {
          if (!entry.isFile()) throw new Error(`网站正文必须是普通文件：${file}`)
          const source = readFileSync(resolve(root, file), 'utf8')
          // VitePress file embedding can otherwise read outside the page discovery scope.
          if (/<!--\s*@include:|^\s*<<</m.test(source)) {
            throw new Error(`网站正文不能嵌入其他源文件，请直接保存脱敏后的内容：${file}`)
          }
          const { path } = contentLocation(file)
          if (path.startsWith('docs/') || path.startsWith('daily/')) checkPlainMarkdown(source, file)
          pages.push(file)
        }
      } else {
        const pattern = escapeGlob(file)
        exclusions.push(pattern, `${pattern}/**`)
      }
    }
  }
  visit()
  return { pages: pages.sort(), exclusions }
}

export function siteBase(value = '/') {
  if (!/^\/(?:[^/\\?#%\s]+\/)*$/.test(value) || value.split('/').some(part => part === '.' || part === '..')) {
    throw new Error('SITE_BASE 必须是以斜杠开头和结尾的 URL 路径，不能包含查询、编码或相对路径。')
  }
  return value
}
