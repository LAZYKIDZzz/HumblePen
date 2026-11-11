import { readLibrary } from '../../scripts/content.mjs'

export default {
  watch: ['../../docs/skills/*.md', '../../daily/*.md', '../../en/docs/skills/*.md', '../../en/daily/*.md'],
  load() { return { root: readLibrary(), en: readLibrary(undefined, 'en') } },
}
