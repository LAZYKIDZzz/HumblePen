# Q&A input and Codex automation

[简体中文](../automation.md)

## Try it with fictional Q&A

Run `npm ci`, then open a Codex chat for the HumblePen project and send this request.

> Run $humblepen-daily with examples/sample-qa.en.json to organize the fictional Q&A for 2026-01-02. Keep the language of the Q&A and leave the changes locally for review.

Expect an update to `SK-001` explaining literal matching and a new note about counting matching lines. Review the skill index and daily summary. Run the same input again and confirm that it adds no duplicate entries.

## Import your own Q&A

Prepare a local Markdown or JSON file from an authorized source. For JSON, use the [fictional Q&A](../../examples/sample-qa.en.json) as a template. Interpret the date in `timeZone`. Store the question time, question, and matching answer in each entry. Use `null` when there is no answer. Keep only the excerpts you need. Keep real input outside Git or in the ignored `.private/inbox/` directory. Give the skill the file path and date. It uses the main language of each Q&A. In a mixed batch, it files each entry by its own language.

## Use the read-only Codex collector

Install the Codex CLI and make sure the desktop task can run it and read its visible local history. Run the collector from the HumblePen root.

```sh
node scripts/collect-codex.mjs \
  --project /path/to/source-project \
  --timezone Asia/Shanghai
```

Repeat `--project` for each authorized project root. It must match the working directory recorded for the session. Add `--archived` to include archived sessions. Use `--date YYYY-MM-DD` to collect a finished day. The default is yesterday in the selected time zone.

The collector uses the local Codex App Server over standard input and output. It reads interactive sessions in the authorized directories and filters turns by their start time. It extracts the initial user message and final text answer. Import cloud history, other tools, attachments, tool results, and follow-ups within the same turn separately. Use manual import if your CLI version lacks the required timestamps or turn history endpoint.

The collector prints the count and status, then saves the snapshot in the restricted `.private/inbox/YYYY-MM-DD.json` file. A partial read has status `partial`. A successful read with no results has status `complete` and an empty list. A failed command exits with a nonzero status. Keep actual Q&A snapshots as local files. When AI organizes the material, the configured model service processes selected excerpts. Limit the inputs according to the service's data policy and your authorization. Remove local snapshots when you no longer need them. After changing the task environment, CLI, or account, run the collector manually to verify its coverage.

[Codex App Server documentation](https://learn.chatgpt.com/docs/app-server#threads)
