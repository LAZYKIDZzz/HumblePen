<script setup>
import { useData } from 'vitepress'

const { localeIndex } = useData()
const enabled = import.meta.env.VITE_SITE_AUTH_PROVIDER === 'authelia'
</script>

<template>
  <a v-if="enabled" class="session-logout" href="/auth/" target="_self">{{ localeIndex === 'en' ? 'Account / Sign out' : '账号 / 退出' }}</a>
</template>

<style scoped>
.session-logout { margin-left: 16px; color: var(--vp-c-text-2); font-size: 14px; white-space: nowrap; }
.session-logout:hover { color: var(--vp-c-brand-1); }
</style>
