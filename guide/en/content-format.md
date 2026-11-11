# Note format

[简体中文](../content-format.md)

## Choose and merge notes

Save reusable technical knowledge the user asked about. Give each topic one stable ID. Search both language libraries by question, term, or command before writing. Use an existing ID for a follow-up or a translation. Keep a short, redacted correction entry when an answer changes. Skip requests to perform work, business updates, project implementation details, and troubleshooting logs without a reusable lesson. Mark unresolved or conflicting answers as **Needs verification** and record established facts.

Allocate new IDs by adding one to the highest ID across both languages. Pad the number to at least three digits. Concurrent runs can pick the same ID, so run one daily task per repository and check the main branch and IDs again before merging.

## Notes and daily summaries

Write English notes in `en/docs/skills/SK-NNN.md`. Write Simplified Chinese notes in `docs/skills/SK-NNN.md` using the Chinese format. A translated note keeps the original ID and uses the title, category, and date labels for its own language. Both versions can evolve independently. Update both when the requested scope is bilingual.

```markdown
# SK-005 | Check the version of an example tool

Category: Command line | Keywords: version, command line.

First recorded: 2026-01-02 | Last updated: 2026-01-02 | Last reviewed: 2026-01-02

**Question:** How can I check the version of the command-line tool in use?

## Answer and example

Look up the version flag in the tool's documentation, such as `example-cli --version`.

## When to use it

Use this command when the tool documents the version flag.

Source: 2026-01-02, fictional Q&A example.
```

Keep the first recorded date fixed. Change the last updated date when the content changes, and the last reviewed date when someone reviews the note. Initialize all three fields to the recording date for a new note. A correction entry can record the date and a redacted explanation.

Register new English notes in `en/docs/skill-index.md`. In `en/daily/YYYY-MM-DD.md`, link new or revised English notes with a relative link such as `[SK-005 Check the version of an example tool](../docs/skills/SK-005.md)`. Use `**Partial record.**` on its own line when an English summary is incomplete. Keep summaries and their links in the same language. Backfill using the source date. Re-running the same input should produce no duplicate note, source, or update entry. The build generates navigation and search.

## Redaction and rendering

Replace environment-specific values with examples like `/path/to/file.txt`, `example.com`, `user@example.com`, `192.0.2.10`, or `<TOKEN>`. Remove private chat links, identifiers, business data, and source mappings. Generalize the case and review advisory IDs, repository URLs, package names, and configuration names that might identify it. Keep the command structure and the conditions under which it applies. For the source, include a date and a generalized description.

Use plain Markdown and put code in fenced blocks with language tags such as `sh`, `json`, or `html`. Note validation restricts executable HTML, Vue expressions, images, frontmatter, and file inclusion. Run `npm run check` and review each note before publishing.
