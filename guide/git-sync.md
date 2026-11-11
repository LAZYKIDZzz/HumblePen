# 同步本地笔记到 GitHub

[English](en/git-sync.md)

初次创建时，使用公开模板生成自己的仓库，或把准备好的模板文件放入新的仓库。按部署用途选择可见性，默认分支使用 `main`。在本地只给整理任务访问目标仓库所需的 Git 认证，并把认证保存在系统凭据管理器或 SSH 配置中。

如果从本地模板目录开始，先在 GitHub 创建空仓库，核对可见性。审阅模板初次提交的文件后，配置自己的远程地址：

```sh
git remote add origin 'git@github.com:<OWNER>/<REPOSITORY>.git'
git remote get-url --push origin
git push -u origin main
```

上面的 push 需要已经创建本地初始提交。从 GitHub 模板克隆的仓库已带有 `origin`，直接核对即可。

## 每日同步

在正确的 checkout 审阅本次差异，确认笔记来源已脱敏、文件路径在日常范围内。新文件也要逐个检查。

```sh
npm run check
git status --short
git diff
git add -- docs/skills/SK-005.md docs/个人技能记录清单.md daily/2026-01-02.md
npm run check:staged
git diff --cached
git commit -m "docs: update knowledge notes"
git push origin HEAD:refs/heads/main
```

把示例日期和编号换成本次实际改动。如果本批次包含英文笔记，按实际改动暂存对应的 `en/docs/` 和 `en/daily/` 文件。无变化跳过提交。暂存校验面向日常内容更新，初次提交模板或维护站点代码时改用完整仓库审阅与 CI 检查。若远端要求 PR，按该仓库的合并流程操作。对公开目标，在上传任何分支或 PR 前完成内容审阅。遇到冲突保留本地修改，按普通 Git 流程处理。

## 私有库自动同步

启用前由用户显式授权，并将允许写入的 `<OWNER>/<REPOSITORY>`、远程名 `origin` 和分支 `main` 固定在私有定时任务配置中。安装并登录 GitHub CLI，核对 `origin` 的 fetch URL 与 push URL 都指向所配置的同一仓库，再通过 `gh repo view <OWNER>/<REPOSITORY> --json nameWithOwner,visibility` 确认可见性是 `PRIVATE`。每次 push 前重复确认，任何信息缺失或不一致都保留本地结果。

自动同步使用专用的干净 checkout。运行开始时记录 HEAD，确认本地分支与目标远端一致且无未提交改动。内容生成后完成语义审阅，按显式路径暂存，通过两个检查，再按固定目标提交和推送。远端拒绝或出现并发更新时保留本地提交并报告，后续人工处理。服务端发布沿用只读拉取。
