# Codex scheduled task prompt

[简体中文](../scheduled-prompt.md)

Replace the example paths, time zone, and time. Try the workflow manually in a project chat before scheduling it. Use **Run now** with the same environment and permissions to verify the source coverage and the changes it makes.

```text
Create a standalone daily scheduled task for the local HumblePen project at /path/to/humblepen.
Run it daily at 08:00 in Asia/Shanghai, from the project directory.

Call $humblepen-daily for yesterday in Asia/Shanghai and write English notes and a daily summary.
Read only the Codex project I authorize at /path/to/source-project.
Run the read-only collector as described in guide/en/automation.md.
If collection fails or returns partial results, report the status and stop before writing.
Keep reusable technical Q&A. Search existing notes before updating an ID or creating a note.
Redact the content, update the skill index and daily summary, and run npm run check.
Leave changes locally for review. Do not stage, commit, or push.
If there are no material changes, report the status. Include only the date, note IDs, the number of unresolved items, and check results.
```

For both languages, ask for Simplified Chinese and English notes and daily summaries. Project-scoped tasks require the computer to be online, the desktop app to be running, and the project to be accessible. Managed workspaces also need the relevant feature and permissions. For an isolated worktree, verify access to dependencies and local inputs, then review the changes in that worktree. [Private sync configuration](git-sync.md) · [OpenAI scheduled tasks](https://learn.chatgpt.com/docs/automations)
