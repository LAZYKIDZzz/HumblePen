<p align="center">
  <img src=".vitepress/theme/brand/humblepen-icon.svg" width="80" height="80" alt="HumblePen 图标">
</p>

<h1 align="center">HumblePen 烂笔头</h1>

<p align="center">简体中文 · <a href="README.en.md">English</a></p>

和 AI 一起排查问题、读文档、试命令时，有用的解释往往散在多轮对话里。下次碰到类似问题，还得翻旧聊天，或者重新问一遍。

HumblePen 从一个每日习惯开始。每天回看昨天问过的问题，把还会用到的答案写成 Markdown 笔记。后来弄清了新的适用条件，或发现原答案有误，就更新同一篇笔记。每天留一份简短摘要，几个月后仍能按问题、命令或关键词找到当时积累的知识。

这个项目开源了这套记录方法和配套的 AI 工作流。AI 帮你筛选问答、归并重复主题和起草笔记，你审阅内容与脱敏结果。笔记可以直接读，也可以生成一个支持简体中文、英文和全文搜索的网站。

## 🗓️ 每天怎么整理

1. **📥 回看昨天的问题。** 手动导入问答，或让只读采集器读取指定 Codex 项目的本地历史。先用随附的虚构问答试跑，核对它选了哪些问题。 [自动化指南](guide/automation.md)
2. **📝 把问答写成可复用的笔记。** 调用 `$humblepen-daily`，先查已有笔记，再补充原条目或分配新编号。写清答案、适用条件和来源，把当天有变化的条目链接到每日摘要。 [Codex Skill](.agents/skills/humblepen-daily/SKILL.md) · [内容规范](guide/content-format.md) · [每日摘要示例](daily/2026-01-01.md)
3. **⏰ 把试跑设成每日任务。** 手动运行满意后，设置执行时间、时区和允许读取的项目。任务默认生成本地差异，便于逐篇审阅。 [定时任务提示词](guide/scheduled-prompt.md)
4. **✅ 审阅后同步。** 检查答案是否准确、案例能否被反推，以及暂存区是否只包含本次要提交的笔记，再推送到自己的仓库。 [Git 同步指南](guide/git-sync.md)
5. **🌐 发布并查阅。** 示例站用 GitHub Pages 发布。站点上线后，顶部「部署示例」可直接打开两篇部署笔记。需要限制阅读权限时，可以使用私有服务器。 [GitHub Pages 部署笔记](docs/skills/SK-003.md) · [私有服务器部署笔记](docs/skills/SK-004.md)

## 💻 在本机看看

用 Node.js 22 或更新版本在仓库根目录运行 `npm ci && npm run dev`。打开终端给出的地址，试搜「固定文字」，再从「每日更新」回看这篇笔记的记录。

[MIT 许可证](LICENSE)
