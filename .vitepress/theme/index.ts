import DefaultTheme from 'vitepress/theme'
import { useData, withBase } from 'vitepress'
import { h } from 'vue'
import SessionControls from './SessionControls.vue'
import KnowledgeLibrary from './KnowledgeLibrary.vue'
import UpdateLog from './UpdateLog.vue'
import brandIcon from './brand/humblepen-icon.svg?no-inline'
import { installSearchTokenizer } from '../search.mjs'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    const { frontmatter, localeIndex } = useData()
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-before': () => h('img', { class: 'brand-icon', src: brandIcon, width: 30, height: 30, alt: '' }),
      'nav-bar-content-after': () => h(SessionControls),
      'doc-before': () => {
        const link = frontmatter.value.translationLink
        return link ? h('div', { class: 'note-translation' }, [
          h('a', { href: withBase(link), hreflang: localeIndex.value === 'en' ? 'zh-CN' : 'en' },
            localeIndex.value === 'en' ? '简体中文' : 'Read in English'),
        ]) : null
      },
    })
  },
  enhanceApp({ app, siteData }) {
    installSearchTokenizer(siteData.value)
    app.component('KnowledgeLibrary', KnowledgeLibrary)
    app.component('UpdateLog', UpdateLog)
  },
}
