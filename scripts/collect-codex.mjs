import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = fileURLToPath(new URL('../', import.meta.url))
const windowDays = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
})

function previousDay(day) {
  const date = new Date(day + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(+date) || windowDays.format(date) !== day) {
    throw new Error('请使用有效的 YYYY-MM-DD 日期。')
  }
  date.setUTCDate(date.getUTCDate() - 1)
  return windowDays.format(date)
}

function connect() {
  const server = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'ignore'] })
  const lines = createInterface({ input: server.stdout })
  const incoming = lines[Symbol.asyncIterator]()
  const closed = new Promise((_, reject) => {
    server.on('error', reject)
    server.stdin.on('error', reject)
    server.on('exit', () => reject(new Error('Codex App Server 已退出。')))
  })
  closed.catch(() => {})
  const send = payload => server.stdin.write(JSON.stringify(payload) + '\n')
  let id = 0
  async function request(method, params) {
    const requestId = ++id
    send({ id: requestId, method, params })
    const read = async () => {
      for (;;) {
        const line = await incoming.next()
        if (line.done) throw new Error('会话读取中断。')
        const response = JSON.parse(line.value)
        if (response.id !== requestId) continue
        if (response.error || !response.result) throw new Error('Codex 会话接口请求失败。')
        return response.result
      }
    }
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Codex 会话接口读取超时。')), 20_000)
    })
    try {
      return await Promise.race([read(), closed, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    request,
    initialized: () => send({ method: 'initialized' }),
    close() {
      lines.close()
      server.stdin.end()
      server.kill()
    },
  }
}

async function* entries(request, method, params) {
  let cursor = null
  const seen = new Set()
  do {
    const result = await request(method, { ...params, cursor, limit: 50 })
    if (!Array.isArray(result.data)) throw new Error('Codex 会话接口返回了未知结构。')
    yield* result.data
    cursor = result.nextCursor ?? null
    if (cursor !== null && (typeof cursor !== 'string' || seen.has(cursor))) {
      throw new Error('Codex 会话分页异常。')
    }
    seen.add(cursor)
  } while (cursor !== null)
}

function dayAt(formatter, seconds) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) return null
  const date = new Date(seconds * 1000)
  return Number.isFinite(+date) ? formatter.format(date) : null
}

export async function collect(request, { projects, date, timeZone, archived }) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const rows = []
  const seen = new Set()
  let incomplete = false
  for (const archiveFlag of archived ? [false, true] : [false]) {
    const params = {
      cwd: projects, archived: archiveFlag, sortKey: 'updated_at', sortDirection: 'desc',
      sourceKinds: ['appServer', 'cli', 'vscode'], modelProviders: [], useStateDbOnly: true,
    }
    for await (const thread of entries(request, 'thread/list', params)) {
      const updated = dayAt(formatter, thread.updatedAt)
      if (updated && updated < date) break
      if (!projects.includes(thread.cwd) || typeof thread.id !== 'string') {
        throw new Error('Codex 返回了未知或未授权的会话。')
      }
      if (seen.has(thread.id)) continue
      seen.add(thread.id)
      const query = { threadId: thread.id, itemsView: 'full', sortDirection: 'desc' }
      for await (const turn of entries(request, 'thread/turns/list', query)) {
        const day = dayAt(formatter, turn.startedAt)
        if (!day) {
          incomplete = true
          continue
        }
        if (day < date) break
        if (day !== date) continue
        if ((turn.itemsView ?? 'full') !== 'full' || !Array.isArray(turn.items)) {
          incomplete = true
          continue
        }
        const userMessages = turn.items.filter(item => item.type === 'userMessage')
        if (userMessages.length === 0) continue
        const question = userMessages[0].content.filter(input => input.type === 'text')
          .map(input => input.text).join('\n').trim()
        if (!question) continue
        // This API dates turns, so only the initial user message is attributed to this day.
        const answer = turn.status === 'completed' && userMessages.length === 1
          ? turn.items.findLast(item => item.type === 'agentMessage' && item.phase !== 'commentary')?.text?.trim()
          : null
        if (!answer) incomplete = true
        rows.push({ askedAt: new Date(turn.startedAt * 1000).toISOString(), question, answer: answer || null })
      }
    }
  }
  rows.sort((a, b) => a.askedAt.localeCompare(b.askedAt))
  return { date, timeZone, status: incomplete ? 'partial' : 'complete', entries: rows }
}

function privateDirectory(path) {
  try { mkdirSync(path, { mode: 0o700 }) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  const info = lstatSync(path)
  if (!info.isDirectory() || (info.mode & 0o077)) {
    throw new Error('采集目录必须是普通私有目录，权限为 700。')
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    project: { type: 'string', multiple: true }, date: { type: 'string' },
    timezone: { type: 'string' }, archived: { type: 'boolean' }, help: { type: 'boolean' },
  } })
  if (values.help) {
    console.log('node scripts/collect-codex.mjs --project <absolute-path> --timezone <IANA-time-zone> [--date YYYY-MM-DD] [--archived]')
    return
  }
  if (!values.project?.length || values.project.some(path => !isAbsolute(path)) || !values.timezone) {
    throw new Error('请显式指定允许读取的项目绝对路径和 IANA 时区。')
  }
  const timeZone = values.timezone
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const date = values.date ?? previousDay(today)
  previousDay(date)
  if (date >= today) throw new Error('采集日期必须已经结束。')
  const projects = [...new Set(values.project.map(path => {
    const directory = realpathSync(path)
    if (!lstatSync(directory).isDirectory()) throw new Error('读取范围必须是项目目录。')
    return directory
  }))]
  const server = connect()
  try {
    await server.request('initialize', { clientInfo: { name: 'humblepen', version: '1.0.0' } })
    server.initialized()
    const snapshot = await collect(server.request, { projects, date, timeZone, archived: values.archived })
    const local = resolve(root, '.private')
    const inbox = resolve(local, 'inbox')
    privateDirectory(local)
    privateDirectory(inbox)
    const output = resolve(inbox, date + '.json')
    const temporary = resolve(inbox, randomUUID() + '.tmp')
    try {
      writeFileSync(temporary, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      renameSync(temporary, output)
    } finally {
      rmSync(temporary, { force: true })
    }
    console.log('Collection status / 采集状态: ' + snapshot.status + ', entries / 问答: ' + snapshot.entries.length + ', .private/inbox/' + date + '.json')
  } finally {
    server.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Collection failed. Check arguments, project access, the Codex CLI version, and the App Server endpoint. Discard this run. / 采集失败。请核对参数、项目读取权限、Codex CLI 版本和 App Server 会话接口。本次输出不可用。')
    process.exitCode = 1
  })
}
