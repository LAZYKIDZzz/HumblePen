<script setup>
import { computed, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import brandLogo from './brand/humblepen-logo.svg?raw'
import brandIcon from './brand/humblepen-icon.svg?no-inline'
import { useLibrary } from './library'

const { locale, library, labels, prefix } = useLibrary()
const copy = computed(() => labels.value.home)

const category = ref('')
watch(locale, () => { category.value = '' })
const sort = ref('updated')
const skills = computed(() => {
  const matches = library.value.skills.filter(skill => !category.value || skill.category === category.value)
  return sort.value === 'id' ? matches.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) : matches
})
const updates = computed(() => library.value.updates.filter(update => update.skills.length).slice(0, 4))
function openSearch() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))
}
</script>

<template>
  <main class="library-shell">
    <header class="library-intro">
      <div class="intro-text">
        <div v-if="locale === 'root'" class="intro-brand" v-html="brandLogo"></div>
        <div v-else class="intro-brand"><img :src="brandIcon" alt="HumblePen" width="56" height="56"></div>
        <h1>{{ copy.heading[0] }}<br />{{ copy.heading[1] }}</h1>
        <p class="intro-description">{{ copy.description[0] }}<br />{{ copy.description[1] }}</p>
        <button class="library-search" type="button" @click="openSearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <span>{{ copy.search }}</span><kbd>⌘ / Ctrl K</kbd>
        </button>
        <p class="search-hint">{{ copy.searchHint }}</p>
      </div>
      <aside class="recent-bookmarks" :aria-label="copy.recent">
        <h2>{{ copy.recent }}</h2>
        <div v-for="update in updates" :key="update.date" class="bookmark">
          <a class="bookmark-date" :href="withBase(update.url)">{{ update.date }}<span v-if="update.partial"> · {{ copy.partial }}</span></a>
          <a :href="withBase(update.skills[0].url)" class="bookmark-title">{{ update.skills[0].title }}</a>
          <span v-if="update.skills.length > 1" class="bookmark-count">{{ copy.more(update.skills.length - 1) }}</span>
        </div>
        <a :href="withBase(prefix + '/updates.html')" class="all-updates">{{ copy.allUpdates }}</a>
      </aside>
    </header>

    <section class="knowledge-directory" aria-labelledby="directory-title">
      <div class="directory-toolbar">
        <h2 id="directory-title">{{ copy.directory }} <span>{{ copy.count(skills.length) }}</span></h2>
        <div class="directory-controls">
          <label>{{ copy.topic }} <select v-model="category"><option value="">{{ copy.allTopics }}</option><option v-for="item in library.categories" :key="item">{{ item }}</option></select></label>
          <label>{{ copy.sort }} <select v-model="sort"><option value="updated">{{ copy.latest }}</option><option value="id">{{ copy.byId }}</option></select></label>
        </div>
      </div>
      <ul class="skill-list">
        <li v-for="skill in skills" :key="skill.id">
          <a :href="withBase(skill.url)" class="skill-entry">
            <span class="skill-number">{{ skill.id }}</span>
            <div class="skill-content"><h3>{{ skill.title }}</h3><p>{{ skill.question.replaceAll(String.fromCharCode(96), '') }}</p></div>
            <div class="skill-meta"><span>{{ skill.category }}</span><time :datetime="skill.updated">{{ skill.updated }}</time></div>
          </a>
        </li>
      </ul>
      <p v-if="!skills.length" class="empty-message">{{ copy.empty }}</p>
    </section>
    <p class="library-footnote">{{ copy.footnote }}</p>
  </main>
</template>
