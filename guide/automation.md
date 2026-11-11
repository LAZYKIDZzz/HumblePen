# 问答输入与 Codex 自动化

[English](en/automation.md)

## 用虚构问答手动试跑

先运行 `npm ci`。从 HumblePen 项目的 Codex 会话发起请求：

> 调用 $humblepen-daily，使用 examples/sample-qa.json 整理 2026-01-02 的虚构问答，输出简体中文笔记，仅生成本地差异。

预期结果是在已有 `SK-001` 补充按字面匹配的解释，并创建一篇关于统计匹配行的笔记。检查清单与日摘要，然后以相同输入再运行一次，确认差异没有增加。

## 导入自己的问答

从用户授权的来源准备本地 Markdown 或 JSON 文件。JSON 推荐沿用[虚构问答](../examples/sample-qa.json)的结构。日期按 `timeZone` 解释。每项保存提问时间、问题和对应回答，未得到回答时设为 `null`。记录仅限所需片段。将真实输入放在 Git 之外，或项目内已忽略的 `.private/inbox/`。直接向 Skill 指定文件、日期和输出语言。需要中英双语笔记时，在请求中明确选择两种语言。

## 用 Codex 只读采集器

需要可执行的 Codex CLI，且桌面任务能启动它、读取它可见的本机历史。从 HumblePen 根目录运行：

```sh
node scripts/collect-codex.mjs \
  --project /path/to/source-project \
  --timezone Asia/Shanghai
```

可重复指定 `--project`，每个路径是一个经过授权的项目根目录，与历史会话的工作目录精确匹配。需要明确包含已归档会话时加 `--archived`。用 `--date YYYY-MM-DD` 补采已经结束的日期。默认日期是指定时区的昨日。

采集器通过本机 Codex App Server 标准输入输出接口读取会话和轮次，以轮次开始时间筛选当日。它读取指定目录中本地状态库可见的交互会话，每轮提取初始用户文本及最终文本答复。云端历史、其他工具、附件、工具执行结果和轮内追加消息需另行导入。旧版本若缺少时间或轮次接口，请改用手动输入。

采集成功后只在终端汇报条数和状态，快照写入权限受限的 `.private/inbox/YYYY-MM-DD.json`。部分读取用 `partial` 表示；无结果用 `complete` 和空列表表示；命令失败以非零状态退出。真实问答快照作为本地文件保管。使用模型整理时，所选片段会由配置的模型服务处理，输入范围应符合其数据政策和来源授权。整理后可按需要清理快照。切换任务环境、CLI 或账号后，先做一次手动采集并核对覆盖范围。

[Codex App Server 文档](https://learn.chatgpt.com/docs/app-server#threads)
