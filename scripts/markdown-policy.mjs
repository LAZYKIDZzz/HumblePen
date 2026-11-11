import MarkdownIt from 'markdown-it'

// Parse the ordinary Markdown grammar with HTML enabled so unsafe tokens are visible to the check.
const parser = new MarkdownIt({ html: true })

export function checkPlainMarkdown(source, file) {
  const message = file.startsWith('en/')
    ? 'Notes must use plain Markdown. Put code in fenced blocks.'
    : '笔记仅支持普通 Markdown。请将代码放入代码块。'
  const invalid = () => { throw new Error(file + ': ' + message) }
  if (/^\s*---/.test(source)) invalid()

  function check(tokens) {
    for (const token of tokens) {
      if (['html_block', 'html_inline', 'image'].includes(token.type)) invalid()
      if (token.type === 'fence' && /-vue\b/.test(token.info)) invalid()
      if (token.type === 'text' && (token.content.includes('{{') || /^\s*<<</m.test(token.content))) invalid()
      if (token.children) check(token.children)
    }
  }

  check(parser.parse(source, {}))
}
