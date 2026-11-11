<script setup>
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { useLibrary } from './library'

const { library, labels, prefix } = useLibrary()
const copy = computed(() => labels.value.updates)
const updates = computed(() => library.value.updates.filter(update => update.skills.length))
</script>

<template>
  <main class="updates-shell">
    <header class="updates-intro"><p class="intro-caption">{{ copy.label }}</p><h1>{{ copy.heading }}</h1><p>{{ copy.description }}</p></header>
    <div class="update-timeline">
      <section v-for="update in updates" :key="update.date" class="timeline-day">
        <div class="timeline-date"><h2><a :href="withBase(update.url)">{{ update.date }}</a></h2><span>{{ copy.count(update.skills.length) }}</span><span v-if="update.partial" class="partial-label">{{ copy.partial }}</span></div>
        <ul><li v-for="skill in update.skills" :key="skill.id"><a :href="withBase(skill.url)"><span>{{ skill.id }}</span>{{ skill.title }}</a></li></ul>
      </section>
      <p v-if="!updates.length" class="empty-message">{{ copy.empty }}</p>
    </div>
    <p class="library-footnote"><a :href="withBase(prefix + '/daily/README.html')">{{ copy.all }}</a>{{ copy.footnote }}</p>
  </main>
</template>
