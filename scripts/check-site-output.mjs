import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSiteDirectory, isSitePage, readSiteSources } from './site-policy.mjs'

export function checkSiteOutput(outDir, pages) {
  if (lstatSync(outDir).isSymbolicLink()) throw new Error('发布产物目录不能是符号链接。')
  for (const page of pages) {
    if (!isSitePage(page)) throw new Error(`构建包含未授权的网站正文：${page}`)
  }
  const expected = new Set(['404.html', ...pages.map(page => page.replace(/\.md$/, '.html'))])
  const found = new Set()
  const files = new Set()
  let assets = 0
  function visit(directory = '') {
    for (const entry of readdirSync(resolve(outDir, directory), { withFileTypes: true })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name
      if (file.split('/').some(part => part.startsWith('.'))) {
        throw new Error(`发布产物不能包含隐藏文件或目录：${file}`)
      }
      if (entry.isSymbolicLink()) throw new Error(`发布产物不能包含符号链接：${file}`)
      if (entry.isDirectory()) {
        if (file !== 'assets' && !isSiteDirectory(file) && !file.startsWith('assets/')) {
          throw new Error(`发布产物包含未授权的目录：${file}`)
        }
        visit(file)
      } else if (!entry.isFile()) {
        throw new Error(`发布产物必须是普通文件：${file}`)
      } else if (expected.has(file)) {
        const html = readFileSync(resolve(outDir, file), 'utf8')
        for (const [, attributes, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
          if (!/(?:^|\s)src\s*=/i.test(attributes) && /\bdeserializeFunctions\s*\(|_vp-fn_/.test(script)) {
            throw new Error(`页面启动数据包含需要 unsafe-eval 的序列化函数：${file}。请将客户端函数静态导入主题。`)
          }
        }
        files.add(file)
        found.add(file)
      } else if (file === 'hashmap.json' || file === 'vp-icons.css' ||
        /^assets\/.+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|gif|svg|ico)$/.test(file)) {
        files.add(file)
        assets += 1
      } else {
        throw new Error(`发布产物包含未授权的文件：${file}`)
      }
    }
  }
  visit()
  for (const file of expected) {
    if (!found.has(file)) throw new Error(`发布产物缺少网站页面：${file}`)
  }
  if (!files.has('hashmap.json')) throw new Error('发布产物缺少页面资源映射。')
  let manifest
  try { manifest = JSON.parse(readFileSync(resolve(outDir, 'hashmap.json'), 'utf8')) }
  catch { throw new Error('发布产物的页面资源映射格式错误。') }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('发布产物的页面资源映射格式错误。')
  }
  const pageNames = new Map(pages.map(page => {
    const name = page.replaceAll('/', '_')
    return [name.toLowerCase(), name]
  }))
  const chunks = new Set()
  for (const [key, hash] of Object.entries(manifest)) {
    if (!pageNames.has(key) || typeof hash !== 'string' || !/^[\w-]+$/.test(hash)) {
      throw new Error('发布产物的页面资源映射包含未授权的页面或无效版本。')
    }
    for (const suffix of ['js', 'lean.js']) {
      const chunk = `assets/${pageNames.get(key)}.${hash}.${suffix}`
      chunks.add(chunk)
      if (!files.has(chunk)) throw new Error(`发布产物缺少页面资源：${chunk}`)
    }
  }
  for (const key of pageNames.keys()) {
    if (!Object.hasOwn(manifest, key)) throw new Error(`发布产物缺少页面资源映射：${key}`)
  }
  for (const file of files) {
    if (file.startsWith('assets/') && file.includes('.md.') && !chunks.has(file)) {
      throw new Error(`发布产物包含未授权的页面资源：${file}`)
    }
  }
  return { pages: found.size, assets }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkSiteOutput(resolve('.vitepress/dist'), readSiteSources().pages)
  console.log(`Output check passed / 发布边界检查通过: ${result.pages} pages / 页面, ${result.assets} assets / 资源. Protect private deployments with site-wide access control. / 私有站点须由整站访问控制保护。`)
}
