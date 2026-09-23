# 打字带空格的 Bot

一个 Telegram Bot，支持 `inline` 模式。

方便书写 恶 臭 文 字。

使用原生 Web API 部署到 Cloudflare Workers，不依赖 Telegram Bot 框架或 Node.js 兼容层。

## 使用方式

1. 直接发送消息给机器人 [@kongebot](https://t.me/kongebot) 帮你转换
2. 在消息框内使用`inline mode`：`@kongebot {需要加空格的文字}`

## Cloudflare Workers 部署

要求 Node.js 22 或更高版本，以及一个 Cloudflare 账号。

1. 安装依赖并登录 Cloudflare：

   ```sh
   corepack enable
   yarn install
   yarn wrangler login
   ```

2. 保存 Telegram Bot token 和 webhook 验证密钥：

   ```sh
   yarn wrangler secret put BOT_TOKEN
   yarn wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```

   `TELEGRAM_WEBHOOK_SECRET` 应为随机字符串，只能包含 `A-Z`、`a-z`、`0-9`、`_` 和 `-`。
   如果部署的机器人不是 `@kongebot`，还需要将 `wrangler.toml` 中的
   `BOT_USERNAME` 修改为机器人用户名（不包含 `@`）。

3. 部署 Worker：

   ```sh
   yarn deploy
   ```

   使用 Cloudflare Workers Builds 连接 Git 仓库时，使用以下设置：

   - 构建命令（Build command）：`yarn run build`
   - 部署命令（Deploy command）：`yarn run deploy`
   - 非生产分支部署命令（Non-production branch deploy command）：`yarn run preview:deploy`
   - 根目录（Root directory）：`/`

   项目使用 Corepack、Yarn 4.5.0 和 `yarn.lock`。`yarn run build` 会执行
   Wrangler dry run，在正式部署前验证 Worker 可以正确打包。

   如果需要在每次生产部署后自动更新 Telegram webhook，将部署命令改为
   `yarn run deploy:setup`，并在 **Settings > Build > Build Variables and Secrets**
   中配置：

   - `BOT_TOKEN`：Secret
   - `TELEGRAM_WEBHOOK_SECRET`：Secret
   - `WORKER_URL`：普通变量，例如 `https://kongebot.<你的子域名>.workers.dev`

   Build secrets 与 Worker 运行时 secrets 相互独立，因此 `BOT_TOKEN` 和
   `TELEGRAM_WEBHOOK_SECRET` 仍需在 Worker 的 **Variables and Secrets** 中配置。
   非生产分支继续使用 `yarn run preview:deploy`，不要自动修改生产机器人的 webhook。

4. 将 `.dev.vars.example` 复制为 `.dev.vars`，填写 `BOT_TOKEN`、
   `TELEGRAM_WEBHOOK_SECRET` 和部署后显示的 `WORKER_URL`，然后注册 webhook：

   ```sh
   yarn webhook:set
   ```

   命令会将 `WORKER_URL` 和 [`config.js`](./config.js) 中的 `WEBHOOK_PATH`
   组合成完整 URL，并调用 Telegram `setWebhook`。修改路径时只需修改该文件，
   Worker 与设置命令会使用同一个值。也可以直接传入 Worker URL：

   ```sh
   yarn webhook:set https://kongebot.<你的子域名>.workers.dev
   ```

   查询或删除当前 webhook：

   ```sh
   yarn webhook:info
   yarn webhook:delete
   ```

   `BOT_TOKEN` 和 `TELEGRAM_WEBHOOK_SECRET` 在本地 `.dev.vars` 与 Cloudflare
   secrets 中必须保持一致。设置 `DROP_PENDING_UPDATES=true` 后执行 set 或 delete
   可以丢弃 Telegram 等待发送的旧更新。

本地开发时，将 `.dev.vars.example` 复制为 `.dev.vars` 并填写密钥，然后运行：

```sh
yarn dev
```

根路径 `GET /` 是健康检查端点。Telegram 更新只接受配置路径上的 `POST` 请求。

Worker 入口和机器人逻辑都在 [`index.js`](./index.js)，`wrangler.toml` 直接引用该文件。
