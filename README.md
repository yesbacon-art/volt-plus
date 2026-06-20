# 伏特家 VOLT+

智能电力交易网站生产雏形：完整首页、电力交易、V币中心、Token市场、AI管理、V币实物商城、实时电价、买电/卖电撮合、Stripe 充值 V 币、Polygon/ERC-20 Token 购买入口和电力交割适配器。

## 本地运行

零依赖静态演示版已经可用：

```bash
node scripts/static-server.mjs
```

当前 Codex 运行环境没有全局 `node` 时，可使用捆绑 Node：

```bash
/Users/baconyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/static-server.mjs
```

然后访问：

- 首页工作台：`http://127.0.0.1:4173`
- V币实物商城：`http://127.0.0.1:4173/mall.html`

真实系统使用 Next.js 全栈版，需要先安装依赖并配置数据库：

```bash
pnpm install
pnpm prisma:generate
pnpm db:push
pnpm dev
```

默认访问地址同样是：`http://127.0.0.1:4173`，真实后端商城入口是：`http://127.0.0.1:4173/mall`

常用命令：

```bash
pnpm static:verify
pnpm static:build
pnpm prisma:generate
pnpm db:push
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

没有安装 pnpm 时，也可以直接使用 Node 运行静态验收：

```bash
node scripts/verify-static.mjs
```

该验收会检查：伏特家/VOLT+ 品牌、图片 logo、首页导航、平台英雄区、实时电价脚本、电力买卖、V币中心、人民币充值、Token市场、Token 购买、AI管理、独立 V币实物商城、电力交割和静态服务器资源路径。

## 真实系统发布到 Vercel

真实系统需要部署 Next.js API routes，不能只发布静态 `dist/`。推荐流程：

1. 创建 Vercel Postgres、Neon、Supabase 或 Railway PostgreSQL 数据库。
2. 在 Vercel 项目环境变量中配置 `.env.example` 里的生产值。
3. 配置 Stripe Checkout 和 webhook。
4. 执行数据库 schema 推送，再部署。

本地命令示例：

```bash
pnpm install
pnpm prisma:generate
pnpm db:push
vercel --prod
```

Vercel 后台导入 GitHub 仓库时保持默认项目根目录即可；不要把它配置成静态输出目录，否则登录、充值、钱包账本和商城订单 API 不会工作。

Stripe webhook 地址：

```text
https://你的域名/api/payments/stripe/webhook
```

## 环境变量

从 `.env.example` 复制 `.env.local`，再补充真实配置：

- `DATABASE_URL`：PostgreSQL 连接串。
- `PAYMENT_PROVIDER`：真实充值设为 `stripe`。
- `STRIPE_SECRET_KEY`：Stripe Secret Key。
- `STRIPE_WEBHOOK_SECRET`：Stripe webhook signing secret。
- `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL`：Checkout 完成或取消后的跳转地址。
- `VCOIN_PER_USD` / `VCOIN_PER_EUR` / `VCOIN_PER_GBP`：法币兑换 V 币比例。
- `NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS`：既有 Polygon ERC-20 合约地址。
- `POLYGON_RPC_URL`：Polygon PoS RPC。
- `TOKEN_CONTRACT_ABI_JSON`：Token 合约 ABI。
- `TOKEN_TREASURY_PRIVATE_KEY`：后端 treasury 签名密钥，生产环境必须放在安全密钥系统。
- `TOKEN_SANDBOX_MODE`：设为 `true` 时才生成沙盒 Token 回执。

## 当前边界

- 未配置 Stripe 时，旧版工作台仍可使用 `SandboxRmbPaymentProvider` 做沙盒充值；真实商城充值必须依赖 Stripe Checkout + webhook。
- V 币商城已经具备真实账户、服务端钱包账本、商品库存和订单 API；上线前仍需补充后台运营、退款、发票、物流和风控。
- Token 购买默认不会伪造链上交易；缺少真实转账 worker 时状态为 `AWAITING_TREASURY`。
- 电力交割使用 `SandboxDeliveryProvider`；真实售电公司、电力市场或虚拟电厂接口可通过同名 provider 替换。
- Prisma schema 已覆盖账户、钱包、订单、成交、账本、充值、Token 和交割数据模型；当前 API 先使用内存沙盒状态，便于快速演示和测试。

## 品牌资源

- 当前网站 logo：`public/brand/volt-logo.svg`，以用户提供的 VOLT+ 图片风格重建为可发布图片资源。
- 原 PNG 和大图备份文件保留在本机但不进入发布仓库，避免 GitHub 插件上传二进制资源失败。
