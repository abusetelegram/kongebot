import assert from 'node:assert/strict'
import test from 'node:test'

import {
  handleRequest,
  handleUpdate,
  hash,
  isStartCommand,
  split,
  splitIntoMessages,
} from '../index.js'

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

test('long transformed messages are split within Telegram limits', () => {
  const input = 'A'.repeat(4096)
  const messages = splitIntoMessages(input)

  assert.equal(messages.length, 2)
  assert.ok(messages.every((message) => message.length <= 4096))
  assert.equal(messages.join(' '), split(input))
})

test('a single oversized grapheme falls back to code-point boundaries', () => {
  const input = `a${'\u0301'.repeat(4096)}`
  const messages = splitIntoMessages(input)

  assert.equal(messages.length, 2)
  assert.ok(messages.every((message) => message.length <= 4096))
  assert.equal(messages.join(''), input)
})

test('start commands addressed to another bot are ignored', () => {
  assert.equal(isStartCommand('/start', 'kongebot'), true)
  assert.equal(isStartCommand('/start@KongeBot payload', '@kongebot'), true)
  assert.equal(isStartCommand('/start@OtherBot', 'kongebot'), false)
  assert.equal(isStartCommand('/start@kongebot'), false)
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

test('long text replies are sent as ordered message chunks', async () => {
  const mock = telegramMock()

  await handleUpdate({
    message: { chat: { id: 42 }, text: 'A'.repeat(4096) },
  }, { BOT_TOKEN: 'test-token' }, mock.fetcher)

  assert.equal(mock.calls.length, 2)
  assert.ok(mock.calls.every(({ payload }) => payload.text.length <= 4096))
  assert.equal(mock.calls.map(({ payload }) => payload.text).join(' '), split('A'.repeat(4096)))
})

test('commands addressed to another bot are treated as normal text', async () => {
  const mock = telegramMock()

  await handleUpdate({
    message: { chat: { id: 42 }, text: '/start@OtherBot' },
  }, { BOT_TOKEN: 'test-token', BOT_USERNAME: 'kongebot' }, mock.fetcher)

  assert.equal(mock.calls[0].payload.text, split('/start@OtherBot'))
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

test('Worker webhook accepts a valid update', async () => {
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
