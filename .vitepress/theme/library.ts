import { computed } from 'vue'
import { useData } from 'vitepress'
import { data } from './library.data'

const labels = {
  root: {
    home: {
      heading: ['把问过的知识，', '留在手边。'],
      description: ['从一次提问，到一份可复用的答案。', '记录原理、命令与排查方法，下一次需要时直接查阅。'],
      search: '搜索问题、答案与命令',
      searchHint: '可搜索中文关键词、英文命令和答案中的文字。',
      recent: '最近积累',
      partial: '持续整理',
      more: (count: number) => '及其他 ' + count + ' 个知识点',
      allUpdates: '查看全部更新',
      directory: '知识目录',
      count: (count: number) => count + ' 篇',
      topic: '主题',
      allTopics: '全部主题',
      sort: '排序',
      latest: '最近补充',
      byId: '记录顺序',
      empty: '这个主题还没有笔记。选择其他主题，或使用全文搜索。',
      footnote: '多轮问答合并成一篇笔记，后续追问继续补充。具体环境参数均使用示例。',
    },
    updates: {
      label: '每日更新',
      heading: '一点一点，积累下来。',
      description: '新增、补充和复习，都有迹可循。只展示有知识积累的日期。',
      count: (count: number) => count + ' 个知识点',
      partial: '部分记录',
      empty: '暂无知识更新。新增笔记并记录到每日摘要后，会显示在这里。',
      all: '查看完整每日摘要',
      footnote: '，包括没有新增知识的日期。',
    },
  },
  en: {
    home: {
      heading: ['Keep useful answers', 'within reach.'],
      description: ['Turn a question into a note you can use again.', 'Save explanations, commands, and troubleshooting steps for the next time you need them.'],
      search: 'Search questions, answers, and commands',
      searchHint: 'Search note titles and answers by keyword or command.',
      recent: 'Recent notes',
      partial: 'In progress',
      more: (count: number) => 'and ' + count + ' more',
      allUpdates: 'View all updates',
      directory: 'Knowledge library',
      count: (count: number) => count === 1 ? '1 note' : count + ' notes',
      topic: 'Topic',
      allTopics: 'All topics',
      sort: 'Sort',
      latest: 'Recently updated',
      byId: 'By note ID',
      empty: 'No notes in this topic yet. Try another topic or use search.',
      footnote: 'Follow-up questions update the same note. Commands use example values.',
    },
    updates: {
      label: 'Daily updates',
      heading: 'What changed in your notes',
      description: 'Find new notes, revisions, and reviews by date.',
      count: (count: number) => count === 1 ? '1 note' : count + ' notes',
      partial: 'Partial record',
      empty: 'Daily summaries will appear here when they reference a new or updated note.',
      all: 'Browse all daily summaries',
      footnote: ', including days with no new notes.',
    },
  },
}

export function useLibrary() {
  const { localeIndex } = useData()
  const locale = computed(() => localeIndex.value === 'en' ? 'en' : 'root')
  return {
    locale,
    library: computed(() => data[locale.value]),
    labels: computed(() => labels[locale.value]),
    prefix: computed(() => locale.value === 'en' ? '/en' : ''),
  }
}
