# Codex 定时任务创建提示词

[English](en/scheduled-prompt.md)

把下文中的路径、时区和时间替换为自己的配置。先在项目会话中手动试跑，再创建定时任务。用同一执行环境和权限运行一次「立即运行」，核对来源覆盖和实际差异。

```text
为本机 HumblePen 项目 /path/to/humblepen 创建一个独立的每日定时任务。
每天 08:00（Asia/Shanghai）运行，在该项目目录执行。

每次调用 $humblepen-daily，以 Asia/Shanghai 的昨日为目标日期，输出简体中文笔记和日摘要。
来源限定为我授权的 Codex 项目 /path/to/source-project。
按 guide/automation.md 运行只读采集器。若采集失败或部分读取，报告状态并停止写入。
整理可复用的专业问答，先搜索已有技能，再补充原编号或创建新笔记。
按项目规则脱敏，更新清单和昨日摘要，运行 npm run check。
仅生成本地差异，禁止自动暂存、提交和推送。
无有效变化时只汇报状态。报告只包含日期、技能编号、待确认数量和检查结果。
```

需要双语时，把输出要求改为「简体中文和英文笔记及日摘要」。项目型定时任务需要本机保持在线、桌面应用运行、项目可访问。受管工作区还需相应功能与权限。若使用隔离 worktree，运行前确认依赖与本地输入的可访问性，并从该 worktree 审阅差异。私有自动同步的单独配置见 [Git 同步](git-sync.md)。

[OpenAI 定时任务文档](https://learn.chatgpt.com/docs/automations)
