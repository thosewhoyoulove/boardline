# 职线 Boardline

独立的公开职位聚合 MVP。它从招聘方自己公开的职位接口拉取岗位，规范化后写入数据库，列表和详情页只提供官方申请链接。

这不是 JDWatch，也不调用任何需要登录的私有接口。

## 中文

### 环境

- Node.js 20.19 或更新版本（建议 22）
- npm

本地默认使用 SQLite，不需要安装数据库。部署到 Vercel 时改用 Neon 上的 Postgres，见下文。

### 安装、迁移、抓取、启动

```bash
npm install
npx prisma migrate dev
npm run scrape
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

`npm install` 会执行 `prisma generate`。仓库里的 `.env` 只包含本地 SQLite 地址 `file:./dev.db`，没有密钥，所以这四步不需要再复制环境变量。

### 抓取

```bash
npm run scrape
```

脚本会：

1. 如果还没有示例公司，写入 Linear、Notion、Ashby 三条 `ashby_api` 数据源（社会招聘）。
2. 按数据源调用适配器。请求之间间隔 800ms，并带上可识别的 User-Agent。
3. 把职位规范化后按 `uniqueKey`（`ashby_api:{boardSlug}:{jobId}`）upsert。
4. 实时接口返回的是完整列表时，把这次没出现的职位标成 `isActive = false`。

没有外网，或公开接口暂时失败时，会改用 `fixtures/ashby/*.sample.json`。样例不是完整列表，因此**不会**把缺失职位下线。也可以强制离线：

```bash
npm run scrape -- --offline
```

只抓取 `active = true` 的公司，以及 `isActive = true` 的数据源。

### 页面

- `/` 职位列表。可用关键词、公司、地点筛选，关键词匹配标题、类别、公司名、地点和描述。
- `/jobs/[id]` 职位详情。描述会做 HTML 消毒。申请按钮只指向官方 `applyUrl`（没有时才用职位页 URL）。
- `/companies` 已接入的公司、在招数量和官方招聘页。

### 适配器

抓取逻辑在 `src/lib/crawlers/`。`ashby_api` 请求：

```text
GET https://api.ashbyhq.com/posting-api/job-board/{boardSlug}
```

不需要登录。当前公开响应大致为 `{ apiVersion, jobs: [...] }`，职位字段包括 `id`、`title`、`department`、`location`、`secondaryLocations`、`publishedAt`、`applyUrl`、`jobUrl`、`descriptionHtml`、`descriptionPlain`。新增来源时实现 `CrawlerAdapter`，并在 `registry.ts` 注册 `sourceType`。

要再加一家使用 Ashby 的公司，插入 `companies` 和 `dataSources` 即可，`config` 示例：

```json
{ "boardSlug": "notion" }
```

`recruitmentType` 取 `social`（社会招聘）或 `campus`（校园招聘）。当前示例都是社会招聘。

### 换到 Postgres / Neon

SQLite 迁移不能直接套到 Postgres。切换时用一套新的迁移：

1. 在 [Neon](https://neon.tech) 创建一个免费 Postgres 项目。
2. 把 `prisma/schema.prisma` 里的 `provider` 改成 `"postgresql"`。
3. 删掉 `prisma/migrations`（里面是 SQLite 方言）。
4. 设置连接串。应用运行时可以用 Neon 的 pooled URL；`prisma migrate` 更适合直连（非 pooler）URL。

   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require" npx prisma migrate dev --name init_postgres
   ```

5. `src/lib/db/client.ts` 看到 `postgres://` 或 `postgresql://` 时会使用 `@prisma/adapter-pg`。改完 provider 后执行 `npx prisma generate`。
6. 再跑 `npm run scrape`。

不要把真实数据库密码写进已提交的 `.env`。本地文件只保留 SQLite 地址；生产环境变量放在 Vercel 或 Neon 的控制台。

### 部署到 Vercel（不自建服务器）

1. 按上一节把数据库换成 Neon，并提交 Postgres 迁移。
2. 把代码推到 Git 托管，在 Vercel 导入项目。
3. 设置环境变量 `DATABASE_URL` 为 Neon 连接串。
4. 构建命令：

   ```bash
   npx prisma generate && npx prisma migrate deploy && next build
   ```

Vercel 的 Serverless 文件系统是临时的，不要把 SQLite 文件当成生产库。Hobby 计划可以之后用 Cron 定时抓取，但触发地址必须校验密钥，避免公开接口被拿去反复请求 Ashby。这个 MVP 没有开放抓取 HTTP 接口。

### 伦理与使用边界

- 只使用公开、无需登录的招聘接口。不要绕过登录、不要打私有 API、不要无视 `robots.txt` 或服务条款。
- Ashby 的 posting API 是给招聘板用的公开 JSON。即便如此，也要限速、串行请求，并在 User-Agent 里说明用途。
- 申请只跳到官方 URL。不要代投、不要伪造内推链接、不要把简历流量引到与招聘方无关的页面。
- 职位描述里可能有人名或联系方式。不要另做追踪，页面上也不要注入第三方脚本。
- 如果一家公司要求停止收录，把对应 `dataSources.isActive` 或 `companies.active` 设为 false。

### 测试

```bash
npm test
```

用提交的 Linear 样例检查规范化、官方链接和脚本标签消毒。

### 下一步

- 更多适配器：Greenhouse、Lever 等同样公开的职位板 JSON。
- 定时抓取：GitHub Actions，或带 `CRON_SECRET` 的 Vercel Cron。
- 新职位提醒：对比 `firstSeenAt` / `uniqueKey`，发邮件或 Slack。
- Postgres 全文检索，替代现在的内存关键词过滤。
- 同一职位多来源去重，以及校园招聘数据源。

## English

Boardline is a small public job board. It fetches roles from employers' own public posting APIs, stores them, and links only to the official apply URL.

### Setup

Requires Node.js 20.19+ (22 recommended).

```bash
npm install
npx prisma migrate dev
npm run scrape
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The committed `.env` points at local SQLite (`file:./dev.db`) and contains no secrets.

### Scrape

`npm run scrape` seeds Linear, Notion, and Ashby (`ashby_api`, recruitment type `social`) if they are missing, fetches each active source, and upserts jobs on `uniqueKey` (`ashby_api:{boardSlug}:{jobId}`). Requests are sequential with an 800ms gap and an identifying User-Agent. A full live response marks missing jobs inactive.

If the network fails, the adapter falls back to `fixtures/ashby/*.sample.json`. Fixture imports are not authoritative and do not deactivate other rows. Force that path with:

```bash
npm run scrape -- --offline
```

The Ashby adapter calls `GET https://api.ashbyhq.com/posting-api/job-board/{boardSlug}` with no authentication. Add another adapter in `src/lib/crawlers/` and register it in `registry.ts`.

### Pages

- `/` filterable job list (keyword, company, location)
- `/jobs/[id]` sanitized description and an official apply link only
- `/companies` seeded companies and open-role counts

### Postgres / Neon

SQLite migrations are not portable. To switch:

1. Create a free Neon Postgres database.
2. Set `provider = "postgresql"` in `prisma/schema.prisma`.
3. Delete `prisma/migrations`.
4. Run `npx prisma migrate dev --name init_postgres` with a direct (non-pooler) `DATABASE_URL`.
5. `src/lib/db/client.ts` selects `@prisma/adapter-pg` when the URL starts with `postgres://` or `postgresql://`. Run `npx prisma generate` after changing the provider.
6. Run `npm run scrape` again.

Keep production credentials in the host environment, not in the committed `.env`.

### Deploy on Vercel

Use Neon, not SQLite. Import the Git repo, set `DATABASE_URL`, and set the build command to:

```bash
npx prisma generate && npx prisma migrate deploy && next build
```

Serverless instances do not have a durable local disk. A later cron should be authenticated; this MVP does not expose a public scrape endpoint.

### Ethics

Use public, unauthenticated job-board endpoints only. Respect robots.txt, terms of service, and rate limits. Do not bypass logins or call private APIs. Link applicants only to the employer's official apply URL. Do not proxy applications, invent referral links, or add tracking to descriptions. Deactivate a company or source when asked to stop listing it.

### Next

More public-board adapters, a locked-down cron, alerts for newly seen `uniqueKey`s, Postgres full-text search, and deduplication across sources.
