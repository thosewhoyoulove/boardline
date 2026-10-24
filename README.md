# 职线 Boardline

在线访问：[打开职线 Boardline](https://boardline.vercel.app/)

独立的公开职位聚合 MVP。它从招聘方自己公开的职位接口拉取岗位，规范化后写入数据库，列表和详情页只提供官方申请链接。

这不是 JDWatch，也不调用任何需要登录的私有接口。

## 中文

### 环境

- Node.js 22.x（与项目声明的运行环境一致）
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

1. 写入腾讯、字节跳动、阿里巴巴、美团、京东、小米、滴滴、携程、百度、网易、小红书、华为、哔哩哔哩的社会招聘数据源。早期的 Linear、Notion、Ashby 示例会停用，不再抓取。
2. 按数据源串行调用适配器。公司之间间隔 800ms；同一网站的列表、详情和 CSRF 预请求统一排队，默认至少间隔 1 秒，并增加 0–250ms 抖动，带上可识别的 User-Agent。
3. 用「前端」向公开接口检索，再只保留标题是前端或 AI 前端、且职位要求含中文的社会招聘。产品、运营、算法、后端、客户端、测试、校招和实习都会丢掉。按 `uniqueKey` upsert。
4. 自动翻页（腾讯每页 20 条，其余 30 条），默认每家公司最多 20 页。仅在完整读到列表末尾、没有分页重复或详情失败，且至少收录一个岗位时，才将超过 48 小时没有再次见到的岗位标为 `isActive = false`。页数上限、异常空列表、后续页失败都不会导致旧岗位下线。

在线抓取失败会报告错误，保留已有岗位，不会自动导入样例。某个来源抛错，或某一页没有职位列表时，该来源记为失败或部分扫描并跳过，其他来源继续写入。只要至少有一个来源完成本轮，进程以 0 退出；全部来源都失败时退出码为 1。部分扫描不会下线旧岗位。只有显式离线模式才导入 `fixtures/cn/*.sample.json`，样例**不会**把缺失职位下线：

```bash
npm run scrape -- --offline
```

只抓取 `active = true` 的公司，以及 `isActive = true` 的数据源。再次初始化不会覆盖已有来源的配置，也不会重新启用手动停用的公司或来源。

### 频率、重试与定时运行

单次抓取，或只检查指定公司：

```bash
npm run scrape
npm run scrape -- --company meituan,tencent
```

启动独立常驻 worker，立即抓取一轮，之后默认每 6 小时执行一次：

```bash
npm run scrape:watch
npm run scrape:watch -- --interval-minutes 60
```

worker 必须持续运行；关闭终端、电脑休眠或进程退出后不会继续调度。它不是开机自启服务。生产环境应使用进程管理器或容器运行，Web 应用与 worker 必须连接同一个持久数据库。Vercel 请求函数不适合执行可能持续数分钟的全量抓取，本项目仍不开放抓取 HTTP 接口。

抓取间隔范围为 15–10080 分钟。长任务错过的轮次会跳过，不会补发密集请求。`Ctrl+C` / `SIGTERM` 会等待当前轮次结束，再释放数据库任务锁。数据库租约每 30 秒续期，异常退出后最多约 2 分钟可恢复；多个 worker 或手动命令共享一把锁。

在 `.env` 设置以下选项（默认值见 `.env.example`）：

```dotenv
SCRAPE_MAX_PAGES=20
SCRAPE_REQUEST_DELAY_MS=1000
SCRAPE_RETRIES=2
SCRAPE_TIMEOUT_MS=20000
SCRAPE_INTERVAL_MINUTES=360
SCRAPE_DEACTIVATE_AFTER_HOURS=48
```

每个 `data_sources.config` 也可以单独覆盖 `pageSize`、`maxPages`、`requestDelayMs`、`retries`、`timeoutMs`。例如：

```json
{ "pageSize": 30, "maxPages": 50, "requestDelayMs": 1500, "retries": 2, "timeoutMs": 20000 }
```

网络错误、408/425/429 以及暂时性 5xx 错误默认最多重试 2 次，采用指数退避；403 等永久错误不重试。遵守 `Retry-After`，等待时间超过 60 秒时停止该来源本轮请求，并保留其冷却时间。短页面不直接视为结束，以避免接口限制每页数量造成漏抓；接口忽略分页或返回重叠数据时，本轮不执行下线。

已有安装升级后，先执行 `npx prisma migrate deploy` 和 `npx prisma generate`，创建抓取任务锁表。抓取内容未变化时只更新最近见到时间、发布日期和在招状态，避免重复写入职位正文。

### 页面

- `/` 职位列表。可用关键词、公司、地点筛选，关键词匹配标题、类别、公司名、地点和描述。
- `/jobs/[id]` 职位详情。描述会做 HTML 消毒。申请按钮只指向官方 `applyUrl`（没有时才用职位页 URL）。
- `/companies` 已接入的公司、在招数量和官方招聘页。

### 适配器

抓取逻辑在 `src/lib/crawlers/`。当前示例来源都不需要登录：

- `tencent_api`：`GET https://careers.tencent.com/tencentcareer/api/post/Query?area=cn&language=zh-cn&keyword=前端`，再用 `ByPostId` 取中文职位要求。申请页是 `https://careers.tencent.com/jobdesc.html?postId=`。
- `bytedance_api`：先向公开页面要 CSRF，再 `POST https://jobs.bytedance.com/api/v1/search/job/posts`（`portal_type=2` 社会招聘，关键词「前端」）。申请页是官网职位详情。
- `alibaba_api`：先打开社招列表页拿公开的 `XSRF-TOKEN`，再 `POST https://talent.alibaba.com/position/search`。申请页是官网职位详情。
- `meituan_api`：`POST https://zhaopin.meituan.com/api/official/job/getJobList`，`jobType` 为社招，关键词「前端」。申请页是官网职位详情。
- `jd_api`：`POST https://zhaopin.jd.com/web/job/job_list`。官网没有单独的公开职位页，申请入口是社会招聘列表。
- `xiaomi_api`：飞书招聘公开接口，先要 CSRF，再搜索社招。申请页是官网职位详情。
- `didi_api`：`GET https://talent.didiglobal.com/recruit-portal-service/api/job/front/list`。申请页是官网职位详情。
- `ctrip_api`：`POST https://job.ctrip.com/api/hrrecruit/getJobAd`。校园招聘标题会被丢掉。申请页是官网职位详情。
- `baidu_api`：`POST https://talent.baidu.com/httservice/getPostListNew`（`application/x-www-form-urlencoded`，`recruitType=SOCIAL`）。列表已带中文职位要求。申请页是 `https://talent.baidu.com/jobs/detail/SOCIAL/{postId}`。
- `netease_api`：`POST https://hr.163.com/api/hr163/position/queryPage`，`workType=0` 为社会招聘。实习条目会被丢掉。申请页是 `https://hr.163.com/job-detail.html?id=`。关键词会命中正文里提到前端的其他职位；职位名仍要过前端过滤。2026-10-24 的社招结果里，职位名含「前端」的只有被排除的「偏前端」。
- `xiaohongshu_api`：`POST https://job.xiaohongshu.com/websiterecruit/position/pageQueryPosition`，`recruitType=social`。申请页是官网社招职位页。
- `huawei_api`：`POST https://apigw-dgg-b0.huawei.com/api/apig/channelhw/recruitmentPosition/pub/getJobPage`，`jobType=SR`。这是招聘官网使用的公开网关，请求带上网关公开的 `X-HW-ID`，不是账号密钥。接口不能按关键词检索，所以会翻完社招列表再在本地留下前端职位，并丢掉工作地在境外、港澳台的岗位。空的 `result`（不是空数组）视为该来源失败，不会把旧岗位下线。2026-10-24 的 560 条社招职位名里没有「前端」，因此当轮收录为 0；之后出现的前端职位仍会被这次适配器收录。申请页是 `https://career.huawei.com/cn/social-recruitment-job-list?jobId=`。
- `bilibili_api`：先向 `https://jobs.bilibili.com/api/auth/v1/csrf/token` 要公开 CSRF，再 `POST /api/srs/position/positionList`（社招全职，`X-AppKey` 为招聘站公开的应用标识）。申请页是官网职位详情。

`ashby_api` 仍保留，请求 `GET https://api.ashbyhq.com/posting-api/job-board/{boardSlug}`。新增来源时实现 `CrawlerAdapter`，并在 `registry.ts` 注册 `sourceType`。

以下目标看过公开入口，但没有接进抓取，避免脆弱来源拖垮整轮：

- 快手社招列表要客户端 HMAC 签名，未签名请求不可用。
- 飞书招聘 SaaS（`*.jobs.feishu.cn`）要随前端包变化的请求签名。字节跳动和小米已经覆盖同一类、但不需要这层签名的门户。
- Moka 官网列表（`/api/outer/ats-apply/website/jobs/v2`）返回 AES 密文，不属于当前明文 JSON 适配器。
- Greenhouse、Lever 的公开 JSON 本身稳定。抽查 Binance、Airbnb、Spotify、Palantir 后，中国相关职位没有中文前端社招描述，因此没有写入公司。

`recruitmentType` 取 `social`（社会招聘）或 `campus`（校园招聘）。当前示例都是社会招聘，只保留前端和 AI 前端，并且会丢掉没有中文职位要求的条目。

### 换到 Postgres / Neon

本地 SQLite 和生产 Postgres 使用独立的 schema 和迁移历史，不需要改 provider 或删除本地迁移。`prisma.config.ts` 根据 `DATABASE_URL` 自动选择：本地使用 `prisma/schema.prisma`，Postgres 使用 `prisma/postgres/schema.prisma`。修改数据模型时同步两份 schema，分别生成迁移。

1. 在 [Neon](https://neon.tech) 创建 Postgres 项目，获取连接串。
2. 在运行环境设置 `DATABASE_URL` 为 pooled 连接串；可选 `DATABASE_DIRECT_URL` 为同一数据库的直连地址，仅供迁移使用。不要把真实密码写进仓库的 `.env`。
3. 执行 `npx prisma generate`、`npm run db:deploy`、`npm run scrape`，初始化数据库并抓取真实职位。已有 SQLite 快照不会自动搬入 Postgres。

### 部署到 Vercel（不自建服务器）

1. 在 Vercel 的 Production 环境设置 `DATABASE_URL`，以及可选的 `DATABASE_DIRECT_URL`。Preview 若部署应使用独立数据库，避免预览改动影响生产。
2. 构建命令已写入 `vercel.json`：

   ```bash
   npm run build:vercel
   ```

构建会检查生产数据库、生成对应客户端、执行 Postgres 迁移，再构建页面；缺少 Postgres 配置会失败，避免发布旧 SQLite 快照。生产页面只读取持久数据库，数据缓存每 60 秒可重新验证、最长 300 秒后过期（刷新页面时读取）。

### GitHub Actions 定时抓取

1. 在仓库 Settings → Secrets and variables → Actions 设置 `DATABASE_URL`，与 Vercel 指向同一个生产数据库。可选设置 `DATABASE_DIRECT_URL`。
2. 将 `.github/workflows/scrape.yml` 发布到默认分支，启用 Actions。
3. 首次部署前，在 Actions → Refresh production jobs → Run workflow 手动运行一次；确认抓取日志和网页数据，再启用生产部署。

之后北京时间每天约 02:23、08:23、14:23、20:23 自动抓取（GitHub 调度可能延迟）。任务先部署数据库迁移，再运行抓取；GitHub 并发组和数据库租约避免重复任务。单个来源失败会写在日志里并跳过，不再让整次刷新失败；全部来源都失败时工作流仍显示失败。已写入的数据会保留。检查 Actions 日志和职位详情的「最近发现」判断更新是否正常，列表日期优先显示招聘方的发布日期。任务在 GitHub 执行，无需本地电脑常开，也不依赖 Vercel 抓取接口。

### 伦理与使用边界

- 只使用公开、无需登录的招聘接口。不要绕过登录、不要打私有 API、不要无视 `robots.txt` 或服务条款。
- 这些接口都是各自招聘站使用的公开 JSON，不需要登录。即便如此，也要限速、串行请求，并在 User-Agent 里说明用途。
- 申请只跳到官方 URL。不要代投、不要伪造内推链接、不要把简历流量引到与招聘方无关的页面。
- 职位描述里可能有人名或联系方式。不要另做追踪，页面上也不要注入第三方脚本。
- 如果一家公司要求停止收录，把对应 `dataSources.isActive` 或 `companies.active` 设为 false。

### 测试

```bash
npm test
```

用提交的样例检查中文职位要求、官方链接和脚本标签消毒。

### 下一步

- 更多大陆公司的公开招聘接口，以及校园招聘。
- 生产 worker 的进程托管，以及持久抓取历史和失败告警。
- 新职位提醒：对比 `firstSeenAt` / `uniqueKey`，发邮件或 Slack。
- Postgres 全文检索，替代现在的内存关键词过滤。
- 同一职位多来源去重，以及校园招聘数据源。

## English

Boardline is a small public job board. It fetches roles from employers' own public posting APIs, stores them, and links only to the official apply URL.

### Setup

Requires Node.js 22.x, matching the project's declared runtime.

```bash
npm install
npx prisma migrate dev
npm run scrape
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The committed `.env` points at local SQLite (`file:./dev.db`) and contains no secrets.

### Scrape

`npm run scrape` seeds social-hire sources for Tencent, ByteDance, Alibaba, Meituan, JD, Xiaomi, DiDi, Trip.com, Baidu, NetEase, Xiaohongshu, Huawei, and Bilibili, and deactivates the earlier Linear, Notion, and Ashby demos. It searches each public API for frontend roles, then keeps only titles that are frontend or AI-frontend engineering with Chinese requirements. Sources paginate (20 roles per page for Tencent, 30 for the others), up to 20 pages by default. Only exhausted, nonempty, complete scans may deactivate missing roles, after a 48-hour grace period. Truncated, overlapping or failed scans preserve existing jobs. Same-origin requests are serialized with at least a one-second delay and an identifying User-Agent.

Online failures are reported without substituting fixtures. A source that throws, or a page without a job list, is logged and skipped; earlier pages from that source stay a partial scan and do not deactivate existing jobs. The command exits 0 when at least one source finishes, and exits 1 only when every source fails. Explicit fixture imports are non-authoritative and never deactivate other rows:

```bash
npm run scrape -- --offline
```

The seeded adapters call the public career JSON used by each employer's own site. No login is required. `ashby_api` remains available. Add another adapter in `src/lib/crawlers/` and register it in `registry.ts`.

Baidu, NetEase, Xiaohongshu, and Bilibili expose searchable social-hire JSON. A one-page dry run kept Baidu and Xiaohongshu frontend roles, and Bilibili's social search returned one frontend role. NetEase's keyword matches bodies as well as titles; on 24 Oct 2026 the only social title containing 前端 was excluded as 偏前端. Huawei's public social gateway does not accept a keyword, so that source pages the SR list and filters frontend titles locally; a missing `result` fails that source only. The same day's full SR catalog (560 posts) had no frontend titles. Kuaishou (HMAC), Feishu SaaS request signatures, and Moka's encrypted job list were left out. Greenhouse and Lever are stable public JSON, but the China-located postings checked on Binance, Airbnb, Spotify, and Palantir did not include Chinese frontend descriptions, so no company was seeded.

### Scheduling

Run `npm run scrape:watch` for an immediate scan followed by a scan every 6 hours, or `npm run scrape:watch -- --interval-minutes 60`. The worker must remain running; it is not an OS startup service. Deploy it with a process manager and the same persistent database as the web app. Do not run long full scans in a Vercel HTTP function.

Use `npm run scrape -- --company meituan,tencent` to select sources. A shared renewable database lease prevents overlapping runs. Apply `npx prisma migrate deploy` and `npx prisma generate` after upgrading. Source settings and environment defaults are documented in the Chinese section and `.env.example`. Automatic retries honor `Retry-After`; live failures never silently import sample jobs.

### Pages

- `/` filterable job list (keyword, company, location)
- `/jobs/[id]` sanitized description and an official apply link only
- `/companies` seeded companies and open-role counts

### Postgres / Neon

Set `DATABASE_URL` to a persistent Postgres connection string. `prisma.config.ts` automatically selects the separate Postgres schema and migration history in `prisma/postgres/`; local SQLite migrations remain intact. Optionally set `DATABASE_DIRECT_URL` for migrations against the same database. Run `npx prisma generate`, `npm run db:deploy`, and `npm run scrape` for initial data. SQLite snapshots are not imported automatically. Keep both schemas' models in sync and keep credentials outside git.

### Deploy on Vercel

Set the Vercel production `DATABASE_URL` (and optional `DATABASE_DIRECT_URL`). The configured build command is:

```bash
npm run build:vercel
```

It requires Postgres, generates the client, applies migrations, then builds. Configure matching GitHub Actions repository secrets and manually run **Refresh production jobs** before the first deployment. `.github/workflows/scrape.yml` then runs every six hours at minute 23 UTC (scheduling may be delayed), using a concurrency group and shared database lease. A failed source is logged and skipped so the workflow can still succeed; the run fails only when every source fails. Partial results are preserved. Pages revalidate cached database reads after 60 seconds with a 300-second expiration. Preview deployments should use a separate database.

### Ethics

Use public, unauthenticated job-board endpoints only. Respect robots.txt, terms of service, and rate limits. Do not bypass logins or call private APIs. Link applicants only to the employer's official apply URL. Do not proxy applications, invent referral links, or add tracking to descriptions. Deactivate a company or source when asked to stop listing it.

### Next

More public-board adapters, managed production workers and scrape history, alerts for newly seen `uniqueKey`s, Postgres full-text search, and deduplication across sources.
