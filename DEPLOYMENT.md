# 部署 (Deployment)

本应用拆分为 **静态前端 (static frontend)** 和 **后端 API + 数据库 (backend API + database)**:

| 组件 | 运行在哪里 | 如何部署 |
| --- | --- | --- |
| `packages/web` (React/Vite) | **GitHub Pages** — `chenyue-vago.github.io/Urlaub/` | 推送到 `main` 时触发 `.github/workflows/deploy.yml` |
| `packages/api` (Fastify/Prisma) | **Railway** | 推送到 `main` 时触发 `railway.json`(或 Railway auto-deploy) |
| PostgreSQL | **Railway**(托管) | 在 Railway project 里创建一次 |
| Auth | **Clerk**(托管登录) | 在 Clerk dashboard 里配置 |

GitHub Pages 只能托管静态文件,所以 API 和数据库放在 Railway 上。前端通过 HTTPS
调用 API;API 的 CORS allowlist 必须包含 Pages origin,否则浏览器会拦跨域请求。

```
GitHub Pages (web)  ──HTTPS──▶  Railway (api)  ──▶  Railway PostgreSQL
   VITE_API_URL                  WEB_ORIGIN = Pages origin (CORS)
   VITE_CLERK_PUBLISHABLE_KEY    CLERK_SECRET_KEY
         └──────────── Clerk (托管登录) ────────────┘
```

---

## 一次性配置 (One-time setup)

### 1. Railway — 后端 + 数据库

1. 用本 GitHub repo 创建一个 Railway project。Railway 会读取 repo 根目录的
   `railway.json`(build 阶段安装整个 workspace,先构建 `@urlaub/shared` 再构建
   `@urlaub/api`;start command 会先跑 `prisma migrate deploy` 再执行
   `node dist/server.js`)。
2. 在同一个 project 里加一个 **PostgreSQL** 数据库(New → Database → PostgreSQL)。
3. 在 API service 上设置这些变量(Railway → service → Variables):

   | 变量 (Variable) | 值 (Value) |
   | --- | --- |
   | `DATABASE_URL` | 引用 Postgres plugin:`${{Postgres.DATABASE_URL}}` |
   | `WEB_ORIGIN` | `https://chenyue-vago.github.io`(Pages origin —— **不带路径、不带结尾斜杠**) |
   | `CLERK_SECRET_KEY` | 来自 Clerk dashboard(production instance) |
   | `CLERK_PUBLISHABLE_KEY` | 来自 Clerk dashboard(production instance) |
   | `ALLOWED_EMAIL_DOMAINS` | 例如 `vago-solutions.ai` |
   | `AGENT_API_KEY` | *(可选)* 仅在启用 NL/Teams agent 时需要;用一个强随机 secret |
   | `PORT` | 留空 —— Railway 会自动注入,server 读 `env.PORT` |

4. 部署。记下 Railway 分配的公网 URL(例如
   `https://urlaub-api.up.railway.app`)。这个 URL 就是前端的 `VITE_API_URL`。
5. 健康检查:`curl https://<railway-url>/health` → `200`。

> 首次部署会跑 `prisma migrate deploy`,把已提交的 migrations 应用到一个空数据库。
> 它**不会** seed 演示数据 —— seed 脚本仅用于 dev。真实用户通过 Clerk 登录创建
> (用户首次通过认证请求时,API 会 upsert 一条 user 记录)。

### 2. Clerk — production instance

- 把 `https://chenyue-vago.github.io` 加入 allowed origins / frontend hosts。
- 把 **production** 的 publishable + secret key 分别填进 GitHub(见下)和
  Railway(见上)。生产环境不要复用 `pk_test_/sk_test_` 这类测试 key。

### 3. GitHub — 前端 build 配置

前端 build 时会把配置内联进产物(Vite 的 `VITE_*` 变量)。在
**Settings → Secrets and variables → Actions** 里设置:

| 类型 (Kind) | 名称 (Name) | 值 (Value) |
| --- | --- | --- |
| **Variable** | `VITE_API_URL` | 步骤 1.4 拿到的 Railway URL,例如 `https://urlaub-api.up.railway.app` |
| **Secret** | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk **production** publishable key(`pk_live_…`) |

只要缺其中任一个,`deploy.yml` 就会让 build 直接报错失败,这样就不会上线一个
连不上后端、也登录不了的前端。

另外确认 **Settings → Pages → Source = GitHub Actions**(不是 "Deploy from a
branch")。

---

## 配置好之后的部署流程 (Deploy flow)

- **推送到 `main`** →
  - `deploy.yml` 重新构建并把前端发布到 Pages。
  - Railway 重新构建并重新部署 API(顺带跑任何新增的 migrations)。
- **Pull requests** → `ci.yml` 会在一个临时 Postgres 上跑 `npm test` +
  `npm run build`。`main` 分支受 branch-protection 保护,以这个 check 为门禁。

## 部署后冒烟测试 (Post-deploy smoke test)

1. 打开 `https://chenyue-vago.github.io/Urlaub/` —— 登录页正常加载(不是白屏,
   console 无 CORS 报错)。
2. 用公司邮箱登录 → dashboard 从 API 加载出真实的 balance 数据。
3. 提交一条 leave request → 显示为 pending。
4. 以 admin 身份 approve → 状态翻转,audit log 记录该操作。

如果步骤 1 白屏:检查 `VITE_API_URL` / `VITE_CLERK_PUBLISHABLE_KEY` 是否在 Pages
build **之前**就已设置好。如果请求报 CORS 错误:检查 API 的 `WEB_ORIGIN` 是否与
`https://chenyue-vago.github.io` 完全一致。
