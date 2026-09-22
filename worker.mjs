const START_MESSAGE = '你 打 字 带 空 格？\r\n 直接发送要转换的消息，或者在inline模式输入文字'
const DEFAULT_WEBHOOK_PATH = '/telegram-webhook'
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function hash(str) {
  let value = 0

  for (let i = 0; i < str.length; i += 1) {
    value = ((value << 5) - value) + str.charCodeAt(i)
    value |= 0
  }

  return value
}

export function split(str) {
  return Array.from(segmenter.segment(str), ({ segment }) => segment).join(' ')
}

async function callTelegram(env, method, payload, fetcher) {
  if (!env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not configured')
  }

  const response = await fetcher(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let result
  try {
    result = await response.json()
  } catch {
    result = null
  }

  if (!response.ok || !result?.ok) {
    const description = result?.description || `HTTP ${response.status}`
    throw new Error(`Telegram ${method} failed: ${description}`)
  }

  return result.result
}

export async function handleUpdate(update, env, fetcher = fetch) {
  if (update.inline_query) {
    const query = update.inline_query.query || '114514'
    const message = split(query)

    return callTelegram(env, 'answerInlineQuery', {
      inline_query_id: update.inline_query.id,
      results: [{
        type: 'article',
        id: String(hash(query)),
        title: '全部都来个空！',
        description: message.substring(0, 30),
        input_message_content: { message_text: message },
      }],
    }, fetcher)
  }

  if (update.callback_query) {
    return callTelegram(env, 'answerCallbackQuery', {
      callback_query_id: update.callback_query.id,
    }, fetcher)
  }

  const message = update.message
  if (!message || typeof message.text !== 'string') {
    return null
  }

  const text = /^\/start(?:@\w+)?(?:\s|$)/i.test(message.text)
    ? START_MESSAGE
    : split(message.text)

  return callTelegram(env, 'sendMessage', {
    chat_id: message.chat.id,
    text,
  }, fetcher)
}

export async function handleRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url)
  const webhookPath = env.WEBHOOK_PATH || DEFAULT_WEBHOOK_PATH

  if (url.pathname === '/' && request.method === 'GET') {
    return Response.json({ ok: true, service: 'kongebot' })
  }

  if (url.pathname !== webhookPath) {
    return new Response('Not found', { status: 404 })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { allow: 'POST' },
    })
  }

  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    console.error('TELEGRAM_WEBHOOK_SECRET is not configured')
    return new Response('Worker is not configured', { status: 500 })
  }

  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (suppliedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let update
  try {
    update = await request.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    await handleUpdate(update, env, fetcher)
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error(error)
    return new Response('Update failed', { status: 500 })
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env)
  },
}
