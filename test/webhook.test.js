import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWebhookUrl, setWebhook } from '../scripts/webhook.js'

test('buildWebhookUrl combines the Worker origin and configured path', () => {
  assert.equal(
    buildWebhookUrl('https://kongebot.example.workers.dev/old?query=1', 'custom-hook'),
    'https://kongebot.example.workers.dev/custom-hook',
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
    webhookPath: '/telegram-webhook',
    webhookSecret: 'test_secret-123',
  }, fetcher)

  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/setWebhook')
  assert.deepEqual(calls[0].payload, {
    url: 'https://kongebot.example.workers.dev/telegram-webhook',
    secret_token: 'test_secret-123',
    allowed_updates: ['message', 'inline_query', 'callback_query'],
    drop_pending_updates: false,
  })
  assert.equal(result.url, calls[0].payload.url)
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
