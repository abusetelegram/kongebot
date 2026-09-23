import assert from 'node:assert/strict'
import test from 'node:test'

import { WEBHOOK_PATH } from '../config.js'
import {
  buildWebhookUrl,
  deleteWebhook,
  getWebhookInfo,
  setWebhook,
} from '../scripts/webhook.js'

test('buildWebhookUrl combines the Worker origin and configured path', () => {
  assert.equal(
    buildWebhookUrl('https://kongebot.example.workers.dev/old?query=1'),
    `https://kongebot.example.workers.dev${WEBHOOK_PATH}`,
  )
})

test('setWebhook sends the Worker URL, secret, and update types to Telegram', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, payload: JSON.parse(init.body) })
    return Response.json({ ok: true, result: true })
  }

  const result = await setWebhook({
    botToken: 'test-token',
    workerUrl: 'https://kongebot.example.workers.dev',
    webhookSecret: 'test_secret-123',
  }, fetcher)

  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/setWebhook')
  assert.deepEqual(calls[0].payload, {
    url: `https://kongebot.example.workers.dev${WEBHOOK_PATH}`,
    secret_token: 'test_secret-123',
    allowed_updates: ['message', 'inline_query', 'callback_query'],
    drop_pending_updates: false,
  })
  assert.equal(result.url, calls[0].payload.url)
})

test('getWebhookInfo requests the current Telegram webhook state', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, payload: JSON.parse(init.body) })
    return Response.json({ ok: true, result: { url: 'https://example.com' } })
  }

  const result = await getWebhookInfo('test-token', fetcher)

  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/getWebhookInfo')
  assert.deepEqual(calls[0].payload, {})
  assert.deepEqual(result, { url: 'https://example.com' })
})

test('deleteWebhook can discard pending Telegram updates', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, payload: JSON.parse(init.body) })
    return Response.json({ ok: true, result: true })
  }

  await deleteWebhook('test-token', true, fetcher)

  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/deleteWebhook')
  assert.deepEqual(calls[0].payload, { drop_pending_updates: true })
})

test('setWebhook rejects secrets Telegram cannot send', async () => {
  await assert.rejects(
    setWebhook({
      botToken: 'test-token',
      workerUrl: 'https://kongebot.example.workers.dev',
      webhookSecret: 'contains spaces',
    }),
    /TELEGRAM_WEBHOOK_SECRET/,
  )
})
