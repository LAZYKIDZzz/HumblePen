import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress'
import { contentLocales, contentLocation, dailyPage, readLibrary } from '../scripts/content.mjs'
import { buildMiniSearch } from './search.mjs'
import { isSitePage, isSearchPage, readSiteSources, siteBase } from '../scripts/site-policy.mjs'
import { checkSiteOutput } from '../scripts/check-site-output.mjs'

const base = siteBase(process.env.SITE_BASE ?? '/')
const sources = readSiteSources()
const pages = new Set(sources.pages)
const favicon = (href: string): HeadConfig => ['link', { rel: 'icon', type: 'image/svg+xml', href }]

const labels = {
  root: { title: '烂笔头', index: '技能清单', updates: '每日更新', directory: '知识目录',
    allNotes: '全部技能', allUpdates: '全部更新', outline: '本页内容', prev: '上一篇', next: '下一篇',
    appearance: '切换深浅色', language: '选择语言', top: '返回顶部', skip: '跳到正文',
    missing: '页面未找到', goHome: '返回知识库', footer: '日积月累，随时查阅。' },
  en: { title: 'HumblePen', index: 'Skill index', updates: 'Daily updates', directory: 'Knowledge library',
    allNotes: 'All notes', allUpdates: 'All updates', outline: 'On this page', prev: 'Previous', next: 'Next',
    appearance: 'Appearance', language: 'Change language', top: 'Back to top', skip: 'Skip to content',
    missing: 'Page not found', goHome: 'Back to the library', footer: 'Build a library you can return to.' },
}

function localizedTheme(locale: keyof typeof contentLocales): DefaultTheme.Config {
  const { prefix, index, deployment } = contentLocales[locale]
  const library = readLibrary(undefined, locale)
  const language = labels[locale]
  const home = '/' + prefix
  const updates = home + 'updates'
  const deploymentExamples = library.skills
    .filter(skill => skill.category === deployment)
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
    .map(skill => ({ text: skill.title, link: skill.url }))
  return {
    siteTitle: language.title,
    nav: [
      { text: language.index, link: home + index.replace(/\.md$/, '') },
      { text: language.updates, link: updates },
      ...(deploymentExamples.length ? [{ text: deployment, items: deploymentExamples }] : []),
    ],
    sidebar: {
      [home + 'docs/']: [
        { text: language.directory, items: [{ text: language.allNotes, link: home }] },
        ...library.categories.map(category => ({ text: category, collapsed: true,
          items: library.skills.filter(skill => skill.category === category)
            .map(skill => ({ text: skill.title, link: skill.url })),
        })),
      ],
      [home + 'daily/']: [{ text: language.updates, items: [
        { text: language.allUpdates, link: updates },
        ...library.updates.slice(0, 14).map(update => ({ text: update.date, link: update.url })),
      ] }],
    },
    outline: { label: language.outline, level: [2, 3] },
    docFooter: { prev: language.prev, next: language.next },
    darkModeSwitchLabel: language.appearance,
    langMenuLabel: language.language,
    sidebarMenuLabel: language.directory,
    returnToTopLabel: language.top,
    skipToContentLabel: language.skip,
    notFound: { title: language.missing, quote: '', linkText: language.goHome, linkLabel: language.goHome },
    footer: { message: language.footer },
  }
}

export default defineConfig({
  lang: 'zh-CN', title: '烂笔头 · humblepen',
  description: '把问过的知识，留在手边。可检索的个人技能笔记。',
  locales: {
    root: { label: '简体中文', lang: 'zh-CN' },
    ...(pages.has('en/index.md') ? {
      en: { label: 'English', lang: 'en', title: 'HumblePen',
        description: 'Turn useful questions and answers into a searchable knowledge library.',
        themeConfig: localizedTheme('en') },
    } : {}),
  },
  base, cleanUrls: false,
  srcExclude: sources.exclusions,
  markdown: { attrs: { disable: true } },
  vite: { publicDir: false, build: { sourcemap: false } },
  transformPageData(pageData) {
    const file = pageData.relativePath
    if (file !== '404.md' && !isSitePage(file)) {
      throw new Error('Build includes an unauthorized page: ' + file)
    }
    const { locale, path } = contentLocation(file)
    const counterpart = path === contentLocales[locale].index
      ? contentLocales[locale === 'en' ? 'root' : 'en'].index
      : path
    const translation = locale === 'en' ? counterpart : 'en/' + counterpart
    if (pages.has(translation)) {
      pageData.frontmatter.translationLink = '/' + translation.replace(/\.md$/, '.html')
    }
  },
  buildEnd(config) { checkSiteOutput(config.outDir, sources.pages) },
  head: [
    ['meta', { name: 'theme-color', content: '#234a9f' }],
    ...(process.env.NODE_ENV === 'production' ? [] : [favicon(base + '.vitepress/theme/brand/humblepen-icon.svg')]),
  ],
  transformHead({ assets }) {
    const icon = assets.find(asset => asset.startsWith(base + 'assets/humblepen-icon.') && asset.endsWith('.svg'))
    if (!icon) throw new Error('The HumblePen site icon is missing from the build.')
    return [favicon(icon)]
  },
  themeConfig: {
    ...localizedTheme('root'),
    i18nRouting: false,
    search: { provider: 'local', options: {
      detailedView: true,
      miniSearch: buildMiniSearch({
        combineWith: 'AND', prefix: true, fuzzy: false,
        boost: { title: 4, titles: 2, text: 1 },
      }),
      locales: { root: { translations: {
        button: { buttonText: '搜索知识', buttonAriaLabel: '搜索全部知识笔记' },
        modal: { displayDetails: '显示摘要', resetButtonTitle: '清空关键词', backButtonTitle: '关闭搜索',
          noResultsText: '没有找到相关笔记，请换一个关键词。',
          footer: { selectText: '打开', navigateText: '选择', closeText: '关闭' },
        },
      } } },
      _render(src, env, md) {
        if (!isSearchPage(env.relativePath)) return ''
        if (dailyPage.test(contentLocation(env.relativePath).path) && !/SK-\d+/.test(src)) return ''
        return md.render(src, env)
      },
    } },
  },
})
