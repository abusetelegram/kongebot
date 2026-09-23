import { pathToFileURL } from 'node:url'

const DEFAULT_WEBHOOK_PATH = '/telegram-webhook'
const ALLOWED_UPDATES = ['message', 'inline_query', 'callback_query']

export function buildWebhookUrl(workerUrl, webhookPath = DEFAULT_WEBHOOK_PATH) {
  if (!workerUrl) {
    throw new Error('WORKER_URL is required')
  }

  const url = new URL(workerUrl)
  if (url.protocol !== 'https:') {
    throw new Error('WORKER_URL must use HTTPS')
  }

  url.pathname = webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function callTelegram(botToken, method, payload, fetcher) {
  if (!botToken) {
    throw new Error('BOT_TOKEN is required')
  }

  const response = await fetcher(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram ${method} failed with HTTP ${response.status}`)
  }

  return data.result
}

export async function setWebhook({
  botToken,
  workerUrl,
  webhookPath = DEFAULT_WEBHOOK_PATH,
  webhookSecret,
  dropPendingUpdates = false,
}, fetcher = fetch) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret || '')) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must use 1-256 characters from A-Z, a-z, 0-9, _ and -')
  }

  const url = buildWebhookUrl(workerUrl, webhookPath)
  const result = await callTelegram(botToken, 'setWebhook', {
    url,
    secret_token: webhookSecret,
    allowed_updates: ALLOWED_UPDATES,
    drop_pending_updates: dropPendingUpdates,
  }, fetcher)

  return { result, url }
}

export function getWebhookInfo(botToken, fetcher = fetch) {
  return callTelegram(botToken, 'getWebhookInfo', {}, fetcher)
}

export function deleteWebhook(botToken, dropPendingUpdates = false, fetcher = fetch) {
  return callTelegram(botToken, 'deleteWebhook', {
    drop_pending_updates: dropPendingUpdates,
  }, fetcher)
}

function loadLocalEnvironment() {
  try {
    process.loadEnvFile('.dev.vars')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

function shouldDropPendingUpdates() {
  return process.env.DROP_PENDING_UPDATES === 'true'
}

async function main() {
  loadLocalEnvironment()

  const [command = 'info', workerUrlArgument] = process.argv.slice(2)
  const botToken = process.env.BOT_TOKEN

  if (command === 'set') {
    const { url } = await setWebhook({
      botToken,
      workerUrl: workerUrlArgument || process.env.WORKER_URL,
      webhookPath: process.env.WEBHOOK_PATH,
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
      dropPendingUpdates: shouldDropPendingUpdates(),
    })
    console.log(`Webhook configured: ${url}`)
    return
  }

  if (command === 'info') {
    console.log(JSON.stringify(await getWebhookInfo(botToken), null, 2))
    return
  }

  if (command === 'delete') {
    await deleteWebhook(botToken, shouldDropPendingUpdates())
    console.log('Webhook deleted')
    return
  }

  throw new Error(`Unknown command: ${command}. Use set, info, or delete.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
