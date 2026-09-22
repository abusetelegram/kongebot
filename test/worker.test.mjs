import assert from 'node:assert/strict'
import test from 'node:test'

import { handleRequest, handleUpdate, hash, split } from '../worker.mjs'

function telegramMock() {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, payload: JSON.parse(init.body) })
    return Response.json({ ok: true, result: true })
  }

  return { calls, fetcher }
}

test('split separates complete grapheme clusters', () => {
  assert.equal(split('A👨‍👩‍👧‍👦你'), 'A 👨‍👩‍👧‍👦 你')
})

test('hash keeps the existing 32-bit result format', () => {
  assert.equal(hash('114514'), 1449682564)
})

test('text messages are sent back with spaces', async () => {
  const mock = telegramMock()

  await handleUpdate({
    message: { chat: { id: 42 }, text: '你好' },
  }, { BOT_TOKEN: 'test-token' }, mock.fetcher)

  assert.equal(mock.calls.length, 1)
  assert.equal(mock.calls[0].url, 'https://api.telegram.org/bottest-token/sendMessage')
  assert.deepEqual(mock.calls[0].payload, { chat_id: 42, text: '你 好' })
})

test('inline queries return an article result', async () => {
  const mock = telegramMock()

  await handleUpdate({
    inline_query: { id: 'inline-1', query: 'AB' },
  }, { BOT_TOKEN: 'test-token' }, mock.fetcher)

  assert.equal(mock.calls[0].url, 'https://api.telegram.org/bottest-token/answerInlineQuery')
  assert.equal(mock.calls[0].payload.inline_query_id, 'inline-1')
  assert.equal(mock.calls[0].payload.results[0].input_message_content.message_text, 'A B')
})

test('webhook rejects an invalid Telegram secret', async () => {
  const response = await handleRequest(new Request('https://example.com/telegram-webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    body: '{}',
  }), {
    BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'expected',
  })

  assert.equal(response.status, 401)
})

test('webhook fails closed when its Telegram secret is missing', async () => {
  const response = await handleRequest(new Request('https://example.com/telegram-webhook', {
    method: 'POST',
    body: '{}',
  }), { BOT_TOKEN: 'test-token' })

  assert.equal(response.status, 500)
})

test('webhook accepts a valid update', async () => {
  const mock = telegramMock()
  const response = await handleRequest(new Request('https://example.com/custom-hook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': 'expected',
    },
    body: JSON.stringify({ message: { chat: { id: 7 }, text: '/start' } }),
  }), {
    BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'expected',
    WEBHOOK_PATH: '/custom-hook',
  }, mock.fetcher)

  assert.equal(response.status, 204)
  assert.match(mock.calls[0].payload.text, /直接发送/)
})
