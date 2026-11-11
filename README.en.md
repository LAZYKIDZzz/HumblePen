<p align="center">
  <img src=".vitepress/theme/brand/humblepen-icon.svg" width="80" height="80" alt="HumblePen icon">
</p>

<h1 align="center">HumblePen</h1>

<p align="center"><a href="README.md">简体中文</a> · English</p>

When you troubleshoot with AI, read documentation, or try a command, the useful explanation often ends up buried in a long conversation. The next time the problem comes up, you have to dig through old chats or ask the same question again.

HumblePen starts with a daily habit. Look back at yesterday's questions and save the answers you expect to use again as Markdown notes. When a follow-up reveals a new constraint or corrects an answer, update the same note. A short daily summary records what changed, so months later you can still find it by question, command, or keyword.

This project shares that note-taking method and the AI workflow that supports it. AI selects useful Q&A, merges related topics, and drafts notes. You check the facts and review the redactions. Read the Markdown files directly or build a searchable site with Simplified Chinese and English versions.

## 🗓️ The daily workflow

1. **📥 Review yesterday's questions.** Import Q&A yourself or use the read-only collector to retrieve the local history of selected Codex projects. Try the fictional Q&A first and check which questions the workflow picks up. [Automation guide](guide/en/automation.md)
2. **📝 Turn answers into reusable notes.** Run `$humblepen-daily`. Search existing notes, then update an existing entry or assign a new ID. Record the answer, when it applies, and a generalized source. Link the day's changes in the daily summary. [Codex skill](.agents/skills/humblepen-daily/SKILL.md#english) · [Content format](guide/en/content-format.md) · [Sample daily summary](en/daily/2026-01-01.md)
3. **⏰ Schedule the workflow.** After a successful manual run, set the time, time zone, and authorized projects. The scheduled task leaves changes locally for review by default. [Scheduled task prompt](guide/en/scheduled-prompt.md)
4. **✅ Review and sync.** Check the answer, look for details that could identify the original case, and verify that only the intended notes are staged. Then push to your repository. [Git sync guide](guide/en/git-sync.md)
5. **🌐 Publish and browse.** The demo site uses GitHub Pages. Once deployed, switch to English and open either note from **Deployment examples** in the navigation. Use the private-server option when you need to restrict reader access. [GitHub Pages example](en/docs/skills/SK-003.md) · [Private server example](en/docs/skills/SK-004.md)

## 💻 Preview locally

Run `npm ci && npm run dev` from the repository root with Node.js 22 or later. Open the URL printed in the terminal, choose **English** from the site's language menu, and search for “fixed string.” The **Daily updates** page shows when the note was added.

[MIT license](LICENSE)
