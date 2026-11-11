// Shared by the build indexer and the statically imported client theme.
export function tokenize(text) {
  const normalized = text.normalize('NFKC').toLowerCase()
  const tokens = normalized.match(/[a-z0-9_]+|[\p{Script=Han}]+/gu) || []
  return tokens.flatMap(token => {
    if (!/\p{Script=Han}/u.test(token)) return [token]
    const chars = Array.from(token)
    // Deterministic unigram/bigram segmentation works identically in Node and browsers.
    return [...chars, ...chars.slice(0, -1).map((char, i) => char + chars[i + 1])]
  })
}

export function buildMiniSearch(searchOptions) {
  // VitePress serializes enumerable theme options into HTML and restores functions
  // with new Function(), which violates our CSP. Keep the indexer's options out
  // of that payload; the client installs the same tokenizer from its JS module.
  return Object.defineProperty({ searchOptions }, 'options', {
    value: { tokenize }, enumerable: false,
  })
}

export function installSearchTokenizer(site) {
  const search = site.themeConfig.search
  if (search?.provider === 'local') {
    const options = search.options ??= {}
    const miniSearch = options.miniSearch ??= {}
    miniSearch.options = { ...miniSearch.options, tokenize }
  }
}
