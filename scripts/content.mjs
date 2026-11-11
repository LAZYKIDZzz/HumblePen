import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const contentLocales = {
  root: { lang: 'zh-CN', prefix: '', index: 'docs/个人技能记录清单.md', deployment: '部署示例' },
  en: { lang: 'en', prefix: 'en/', index: 'docs/skill-index.md', deployment: 'Deployment examples' },
}

export const skillPage = /^docs\/skills\/SK-\d+\.md$/
export const dailyPage = /^daily\/\d{4}-\d{2}-\d{2}\.md$/

export function contentLocation(file) {
  const locale = file.startsWith('en/') ? 'en' : 'root'
  return { locale, path: file.slice(contentLocales[locale].prefix.length) }
}

const noteFormat = {
  root: {
    heading: /^# (SK-\d+)｜(.+)$/m,
    category: /^分类：([^；\n]+)/m,
    dates: /首次记录：(\d{4}-\d{2}-\d{2})；最近补充：(\d{4}-\d{2}-\d{2})；最近复习：(\d{4}-\d{2}-\d{2})/,
    question: /\*\*问题：\*\*[ \t]*(.+)/,
    keywords: /关键词：([^\n]+)/,
    partial: /部分记录|待次日补齐/,
  },
  en: {
    heading: /^# (SK-\d+) \| (.+)$/m,
    category: /^Category: ([^|\n]+)/m,
    dates: /^First recorded: (\d{4}-\d{2}-\d{2}) \| Last updated: (\d{4}-\d{2}-\d{2}) \| Last reviewed: (\d{4}-\d{2}-\d{2})$/m,
    question: /\*\*Question:\*\*[ \t]*(.+)/,
    keywords: /Keywords: ([^\n]+)/,
    partial: /^\*\*Partial record\.\*\*/m,
  },
}

export function parseSkill(source, file, locale = 'root') {
  const { prefix } = contentLocales[locale]
  const format = noteFormat[locale]
  const heading = source.match(format.heading)
  const category = source.match(format.category)
  const dates = source.match(format.dates)
  if (!heading || !category || !dates || heading[1] + '.md' !== file) {
    const message = locale === 'en'
      ? 'Keep the title, category and all three date fields.'
      : '技能格式不完整。请保留标题、分类及三个日期字段。'
    throw new Error(prefix + 'docs/skills/' + file + ': ' + message)
  }
  return {
    id: heading[1], title: heading[2], category: category[1].trim(),
    first: dates[1], updated: dates[2], reviewed: dates[3],
    question: source.match(format.question)?.[1] || '',
    keywords: source.match(format.keywords)?.[1].replace(/[。.]$/, '') || '',
    url: '/' + prefix + 'docs/skills/' + heading[1] + '.html',
  }
}

function filesIn(directory) {
  try {
    return readdirSync(directory)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export function readLibrary(root = process.cwd(), locale = 'root') {
  const { prefix, lang } = contentLocales[locale]
  const notesDir = resolve(root, prefix, 'docs/skills')
  const dailyDir = resolve(root, prefix, 'daily')
  const skills = filesIn(notesDir)
    .filter(file => skillPage.test('docs/skills/' + file))
    .map(file => parseSkill(readFileSync(resolve(notesDir, file), 'utf8'), file, locale))
    .sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id, undefined, { numeric: true }))
  const notesById = new Map(skills.map(skill => [skill.id, skill]))
  const updates = filesIn(dailyDir)
    .filter(file => dailyPage.test('daily/' + file))
    .map(file => {
      const source = readFileSync(resolve(dailyDir, file), 'utf8')
      const ids = [...new Set(source.match(/SK-\d+/g) || [])]
      const date = file.slice(0, -3)
      return { date, url: '/' + prefix + 'daily/' + date + '.html',
        partial: noteFormat[locale].partial.test(source),
        skills: ids.map(id => notesById.get(id)).filter(Boolean),
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  return { skills, updates, categories: [...new Set(skills.map(skill => skill.category))].sort((a, b) => a.localeCompare(b, lang)) }
}
