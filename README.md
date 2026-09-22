# 打字带空格的 Bot

一个 Telegram Bot，支持 `inline` 模式。

方便书写 恶 臭 文 字。

支持部署到 Cloudflare Workers、AWS Lambda、Fission.io 或普通 Node.js 服务。

## 使用方式

1. 直接发送消息给机器人 [@kongebot](https://t.me/kongebot) 帮你转换
2. 在消息框内使用`inline mode`：`@kongebot {需要加空格的文字}`

## Cloudflare Workers 部署

要求 Node.js 22 或更高版本，以及一个 Cloudflare 账号。

1. 安装依赖并登录 Cloudflare：

   ```sh
   npm install
   npx wrangler login
   ```

2. 保存 Telegram Bot token 和 webhook 验证密钥：

   ```sh
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```

   `TELEGRAM_WEBHOOK_SECRET` 应为随机字符串，只能包含 `A-Z`、`a-z`、`0-9`、`_` 和 `-`。

3. 部署 Worker：

   ```sh
   npm run cf:deploy
   ```

4. 将 Telegram webhook 指向部署后显示的 Worker URL。默认路径是
   `/telegram-webhook`，例如 `https://kongebot.<你的子域名>.workers.dev/telegram-webhook`：

   ```sh
   curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
     --data-urlencode "url=${WORKER_URL}/telegram-webhook" \
     --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
     --data-urlencode 'allowed_updates=["message","inline_query","callback_query"]'
   ```

   上述命令需要本地环境变量 `BOT_TOKEN`、`WORKER_URL` 和
   `TELEGRAM_WEBHOOK_SECRET`。修改 `wrangler.toml` 中的 `WEBHOOK_PATH` 时，
   webhook URL 也必须使用相同路径。

本地开发时，将 `.dev.vars.example` 复制为 `.dev.vars` 并填写密钥，然后运行：

```sh
npm run cf:dev
```

根路径 `GET /` 是健康检查端点。Telegram 更新只接受配置路径上的 `POST` 请求。

## 入口

- [Cloudflare Workers](./worker.mjs)
- [AWS Lambda](./lambda.js)
- [Fission.io/default](./fission.js)
