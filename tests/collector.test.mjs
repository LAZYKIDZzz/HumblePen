import test from 'node:test'
import assert from 'node:assert/strict'
import { collect } from '../scripts/collect-codex.mjs'

const project = '/path/to/project'
const date = '2026-01-02'
const timeZone = 'Asia/Shanghai'
const first = '2026-01-01T16:00:00Z'
const second = '2026-01-02T15:59:59Z'
const before = '2026-01-01T15:59:59Z'
const after = '2026-01-02T16:00:00Z'
const seconds = date => Date.parse(date) / 1000

function turn(instant, question, status = 'completed') {
  return {
    startedAt: seconds(instant), status, itemsView: 'full', items: [
      { type: 'userMessage', content: [{ type: 'text', text: question }] },
      { type: 'agentMessage', phase: 'commentary', text: '中间过程' },
      { type: 'agentMessage', phase: 'final_answer', text: '示例答案' },
    ],
  }
}

test('collector pages updated threads, uses local turn dates and saves only allowed messages', async () => {
  const request = async (method, params) => {
    if (method === 'thread/list') {
      assert.deepEqual(params.cwd, [project])
      assert.equal(params.sortKey, 'updated_at')
      if (params.cursor === null) return {
        data: [{ id: 'old-conversation', cwd: project, updatedAt: seconds(after) }], nextCursor: 'threads-2',
      }
      return { data: [{ id: 'older', cwd: project, updatedAt: seconds(before) }], nextCursor: null }
    }
    assert.equal(method, 'thread/turns/list')
    assert.equal(params.threadId, 'old-conversation')
    assert.equal(params.itemsView, 'full')
    if (params.cursor === null) return {
      data: [turn(after, '次日'), turn(second, '当日第二问', 'inProgress')], nextCursor: 'turns-2',
    }
    return { data: [turn(first, '当日第一问'), turn(before, '前日')], nextCursor: null }
  }
  const snapshot = await collect(request, { projects: [project], date, timeZone })
  assert.deepEqual(snapshot, {
    date, timeZone, status: 'partial', entries: [
      { askedAt: '2026-01-01T16:00:00.000Z', question: '当日第一问', answer: '示例答案' },
      { askedAt: '2026-01-02T15:59:59.000Z', question: '当日第二问', answer: null },
    ],
  })
})

test('collector distinguishes empty authorized input from an out-of-scope response', async () => {
  const settings = { projects: [project], date, timeZone }
  const empty = await collect(async () => ({ data: [], nextCursor: null }), settings)
  assert.equal(empty.status, 'complete')
  assert.deepEqual(empty.entries, [])
  await assert.rejects(() => collect(async () => ({
    data: [{ id: 'unrelated', cwd: '/path/to/another-project', updatedAt: seconds(first) }],
  }), settings), /未授权/)
})
