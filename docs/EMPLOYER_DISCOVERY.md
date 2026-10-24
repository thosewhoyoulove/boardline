# 公司图标与自动扩展招聘来源

## 品牌图标

首页公司卡片使用 `public/company-logos/` 下的官方站点图标。本地托管，不通过第三方图标服务追踪访问。固定图片尺寸，加载失败退回公司名称首字，不影响筛选和卡片布局。

图标来源（品牌及图标权利归对应公司）：

- 腾讯：<https://www.qq.com/favicon.ico>
- 字节跳动：<https://lf-package-cn.feishucdn.com/obj/atsx-throne/hire-fe-prod/portal/mainland/favicon.ico>
- 阿里巴巴：<https://g.alicdn.com/platform/alixiaoyouhui/2.1.6/img/icon.ico?v=20150801>
- 美团：<https://s3plus.meituan.net/zhaopin-official-website-prod/imgs/favicon.ico>
- 京东：官方招聘站引用的 <http://www.360buy.com/favicon.ico>
- 小米：<https://s01.mifile.cn/favicon.ico>
- 滴滴：<https://website.didiglobal.com/DDlogo.ico>
- 携程：<https://job.ctrip.com/ctrip.ico>
- 网易：<https://hr.163.com/favicon.ico>
- 哔哩哔哩：<https://s1.hdslb.com/bfs/static/zhaopin-toc/favicon.ico>

## 两类定时任务

- `scrape.yml`：每 6 小时更新所有已启用的数据源，新增公司接入后自动参与。
- `discover-employers.yml`：每天北京时间 12:41，搜索候选公司的公开招聘接口，首次接入有合格职位的新公司。GitHub 调度可能延迟。支持手动触发与只校验模式。

候选池在 `src/lib/crawlers/employer-catalog.ts`。首批新增网易和哔哩哔哩，两家公司目前覆盖全职前端社招。候选池是经过确认的官方招聘来源，并非无限搜索互联网，也不会通过 AI 猜接口或自动信任任意搜索结果。小红书、快手等需要另行验证后添加适配器和候选配置。

## 自动接入条件

1. 公司身份、招聘入口、接口和详情链接规则已在代码中确认。
2. 完整读完分页；请求失败、页数封顶、重复分页等情况不接入。
3. 严格筛选前端社招标题与中文职位要求，按来源与职位 ID 去重。
4. 职位详情 URL 必须符合官方规则，抽查首条链接的 HTTP 响应与最终地址，拒绝跳转到首页或登录页。该抽查不等于逐条验证页面实际渲染内容。
5. 公司、来源与首批岗位在同一数据库事务内写入，失败整体回滚。没有匹配岗位的公司等下次再探测。
6. 已接入的来源不会重复创建，手动停用的公司/来源保持停用。探测与正常抓取共享工作流并发组及数据库租约。

B 站使用招聘网页公开的访客应用标识与临时 CSRF token，不使用账号 Cookie 或私人凭证。请求复用项目限速、超时、重试机制。

## 操作

在有数据库配置的环境中运行：

```bash
npx tsx scripts/discover-employers.ts --dry-run
npx tsx scripts/discover-employers.ts
```

只校验模式不写入公司或职位，但会短暂获取共享租约。每次输出结果并生成被 Git 忽略的 `employer-discovery-report.json`；GitHub Actions 摘要记录各公司接入、跳过、无岗位或失败状态。失败会使任务报错，其余公司仍会继续处理。

生产任务复用仓库已有 `DATABASE_URL` 和 `DATABASE_DIRECT_URL` Secrets，工作流需推送至默认分支才能开始调度。新增公司的快捷卡片会在页面缓存更新后出现，公司列表缓存配置为 60 秒再验证、300 秒过期。
