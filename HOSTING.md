# Free Entry 托管评估与价格建议

> 2026-09-22 更新：项目已改用 Cloudflare Pages 主站与图片两个免费项目的构建及部署流程。以下为 9 月 12 日的历史评估；现行配置见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

调查日期：2026-09-12。基于当前工作区代码、现有 `dist/`、三国重新构建结果，以及当日核实的服务商官方文档。

## 1. 结论

**这个网站可以免费托管，但当前三国合并部署产物不能原样放进一个免费的 GitHub Pages 或 Cloudflare 静态项目。**

| 方案 | 是否可行 | 明确的托管价格 | 需要的改动 |
|---|---|---|---|
| 当前三国合并产物 → GitHub Pages | 不符合容量限制 | 免费套餐 US$0/月，但当前产物超限 | 必须减小产物 |
| 当前三国合并产物 → 单个 Cloudflare Pages / Workers Free 项目 | 不符合文件数限制 | 免费套餐 US$0/月，但当前产物超限 | 必须减少文件或拆分项目 |
| 按国家只保留实际使用的图片 → GitHub Pages | 容量可行 | **US$0/月，US$0/年** | 修改构建或发布打包步骤，公开仓库使用免费 Pages |
| 主站与图片分成两个 Cloudflare 免费静态项目 | 可行，推荐的零费用方案 | **合计 US$0/月，US$0/年** | 图片统一域名，更新图片引用及相关配置 |
| 单个 Cloudflare Workers Paid + Static Assets | 可行，推荐的省事方案 | **US$5/月；连续使用 12 个月为 US$60** | 修改部署目标，无需因当前规模拆分网站 |
| 阿里云 ECS 经济型 e 活动套餐 | 配置容量足够 | **人民币 99 元/年；折合 8.25 元/月，按年购买** | 符合活动购买条件，自行部署和维护 Web 服务器 |

**我的建议：预算严格为零，选 Cloudflare“主站 + 图片”两个免费项目；愿意用每月 US$5 换取更简单的部署和增长空间，选单个 Workers Paid + Static Assets。** 如果希望尽量沿用现有 GitHub Actions / GitHub Pages 流程，则先做按国家裁剪图片，也能免费上线。

价格口径：上表列托管服务费用；不含已有 `freeentry.org` 域名续费、可能适用的税费、付费 CI 或额外购买的服务。Cloudflare 美元价格不按猜测汇率折算人民币。US$60 是 12 个月月费相加，不是另一个年付套餐。网站目前是纯静态架构，US$5 方案按只使用静态资源托管、无其他收费资源计算。

## 2. 网站实际需要什么运行环境

`astro.config.mjs` 明确配置 `output: 'static'`。HTML 页面在构建时生成，React 地图、筛选和日期计算在浏览器运行；当前不需要常驻 Node.js 服务器、数据库或服务端 SSR。

- Node.js、Astro、Sharp 是构建工具，不需要在托管服务器常驻。
- 地图样式及瓦片来自 `tiles.openfreemap.org`，不存储在本网站产物中，也不经过本站托管服务器转发。
- PWA / Service Worker 是浏览器能力，不等于需要 Cloudflare Worker 后端。
- 图片是本项目自行生成的 JPEG / WebP 静态文件，不需要购买 Cloudflare Images 图片处理服务。

因此，购买 ECS/VPS 并不是运行这个网站的必要条件。

## 3. 现有 dist 的实测结果

当前 `dist/index.html` 对应**比利时站**，不是整个三国网站。

| 指标 | 实测值 |
|---|---:|
| 文件总数 | **6,705** |
| 文件字节总和 | **513,822,216 bytes** |
| 换算体积 | **490.019 MiB** |
| HTML 文件 | 2,501 |
| JPEG 文件 | 1,056 |
| WebP 文件 | 3,034 |
| JavaScript 文件 | 79 |
| 最大单文件 | `_astro/MapApp.BZosVwWz.js`，2,523,824 bytes，约 2.407 MiB |
| 符号链接 | 0 |

这里使用文件内容字节总和，不使用文件系统块占用，也不使用 ZIP/gzip 压缩包大小。1 MiB = 1,048,576 bytes。

| 内容类别 | 文件数 | 字节总和 | 约占整包 |
|---|---:|---:|---:|
| JPEG + WebP 图片 | 4,090 | 433,145,585 | 84.3% |
| HTML | 2,501 | 67,084,092 | 13.1% |
| JavaScript | 79 | 9,582,252 | 1.9% |
| 其他 | 35 | 4,010,287 | 0.8% |

**如果只部署当前这个比利时构建，GitHub Pages 和 Cloudflare 免费静态托管在容量/文件数上都可以容纳。** 但需要按 `/belgium/` 路径组装部署目录，不能无视现有资源 URL 前缀，直接把它当作域名根目录网站上传。

## 4. 真正部署的是三个国家合并

`.github/workflows/deploy.yml` 分别构建法国、意大利、比利时，随后复制到：

```text
site/
  france/
  italy/
  belgium/
  index.html
  404.html
  robots.txt
  CNAME
```

三国重新构建共生成 **16,343 个 HTML 页面**：法国 8,761，意大利 5,081，比利时 2,501。文件数增加主要来自十种语言的详情页与地区、城市、分类页面。

### 4.1 为什么本地合并与干净 CI 合并体积不同

Astro 会复制 `public/` 内的公共资源。当前：

- 1,056 张 JPEG 原图全部被 Git 跟踪，每个国家构建都会复制一遍。
- `public/images/derived/` 被 gitignore；CI 每个国家在独立任务中只生成该国 WebP。
- 本地目录已经积累了三国全部 3,034 张 WebP，所以本地连续构建会把这些 WebP 也全部复制到每一个国家目录。

由此必须区分以下三种口径。表中体积保留一位小数，属于产物规模核算，不能视为已经下载实测的线上 GitHub Actions artifact。

| 产物口径 | 文件数 | 总大小 |
|---|---:|---:|
| 本地保留三国全部图片，构建后三国直接合并 | **28,959** | **约 1,733.9 MiB / 1.693 GiB** |
| 当前 CI：每国全部 JPEG + 该国 WebP，三国合并 | **22,891** | **约 1,263.0 MiB / 1.233 GiB** |
| 优化：每国只保留本国实际使用的 JPEG 和 WebP | **20,779** | **约 907.7 MiB / 0.886 GiB** |

当前 CI 口径的分国数据：

| 国家 | HTML 文件数 | 总文件数 | 大小 |
|---|---:|---:|---:|
| 法国 | 8,761 | 11,585 | 约 560.5 MiB |
| 意大利 | 5,081 | 7,222 | 约 415.1 MiB |
| 比利时 | 2,501 | 4,080 | 约 287.3 MiB |
| 根目录文件 | 2 | 4 | 1,092 bytes |

上面的 16,343 个 HTML 指三国页面，不含根目录另外两个 HTML。

### 4.2 优化能省多少

三国数据集实际使用的图片为：

| 国家 | JPEG 原图 | WebP 派生图 | 合计 |
|---|---:|---:|---:|
| 法国 | 578 | 1,654 | 2,232 |
| 意大利 | 334 | 971 | 1,305 |
| 比利时 | 144 | 409 | 553 |
| 合计 | 1,056 | 3,034 | **4,090** |

当前 CI 把 1,056 张原图复制了三遍。删除跨国家冗余副本，可减少 **2,112 个文件、372,532,766 bytes，约 355.3 MiB**。

这一步不需要降低图片质量，也不需要删除语言或博物馆页面。可在每个国家打包阶段，根据 `data/<country>/museums.json` 保留该国引用的图片，避免直接全量发布 `public/images/`。

但完成后仍有 **20,779 个文件，比 Cloudflare 免费单项目上限多 779 个**。仅做图片按国家裁剪，还不能解决 Cloudflare 免费单项目限制。

## 5. GitHub Pages：能否免费

GitHub 官方当前限制包括：

- 已发布网站不能超过 **1 GB**；这是网站发布体积限制，不只是 Git 仓库大小建议。
- 每月 **100 GB 软性带宽限制**。
- Pages 部署超过 **10 分钟**会超时。
- GitHub Free 的 Pages 面向公开仓库；私有仓库使用 Pages 需要相应付费计划。
- 自定义 GitHub Actions 发布流程不受每小时 10 次 Pages 构建软限制约束。

来源：[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。

判断：

1. **现有 CI 整站约 1.324 GB，超限。** 不能因为当前比利时 `dist` 只有 490 MiB 就判断整站可直接上线。
2. **按国家裁剪图片后约 0.952 GB，容量可行。** 保守按十进制 1 GB 比较，余量约 48 MB，不算宽裕；应在发布前设置文件字节总和检查。
3. 月流量需要上线后观察。比如假设每次访问实际从本站传输 2 MB，则 100 GB 大致对应 50,000 次访问；这只是明确假设下的算术示例，不是实测访问容量。页面缓存、PWA 预缓存、机器人抓取及浏览深度都会改变结果。

完整网站总大小不等于每个访问者的下载量。地图瓦片从外部服务直连，也不应计入本站流量估算。

**适用建议：** 如果优先保持目前 GitHub Pages 工作流，并且预期流量不大，先做图片裁剪即可。托管费明确为 US$0/月。公开仓库的标准 GitHub-hosted runner 构建时间免费，但仍应合理管理 artifact 留存及其他账户额度。[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## 6. Cloudflare：免费版与 US$5 方案

### 6.1 官方限制与计费

| 项目 | Cloudflare Pages Free | Workers Static Assets Free | Workers Static Assets Paid |
|---|---:|---:|---:|
| 每次部署静态文件上限 | 20,000 | 20,000 | 100,000 |
| 单文件上限 | 25 MiB | 25 MiB | 25 MiB |
| 纯静态资源请求 | 免费 | 免费且不限次数 | 免费且不限次数 |
| 托管基础费用 | US$0/月 | US$0/月 | US$5/月 |

来源：[Pages limits](https://developers.cloudflare.com/pages/platform/limits/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[静态资源计费](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Pages 产品说明](https://www.cloudflare.com/products/pages/)。

Pages 免费版还有每月 500 次构建、单次构建 20 分钟限制。控制台拖拽上传只支持 1,000 个文件，这个项目应使用 Git 集成或 Wrangler CLI，不能把拖拽界面的限制误认为平台整体上限。[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

当前最大文件约 2.407 MiB，远低于 25 MiB。**Cloudflare 的问题是整站文件数，不是某张图片或 JS 文件过大。**

注意：Workers 免费版每天 100,000 次的限制针对 Worker 脚本执行，不应套用到直接托管的纯静态资源请求。避免为了静态托管把所有请求配置成 `run_worker_first`。未来增加 SSR、API、数据库等功能时应重新计费。

### 6.2 零费用推荐：主站 + 图片两个静态项目

把所有博物馆图片统一放到独立静态项目，例如 `images.freeentry.org`；主站保留三国 HTML、JS、CSS、PWA 及其他资源。

| 项目 | 文件数 | 大小 | 费用 |
|---|---:|---:|---:|
| 主站 `freeentry.org` | 约 **16,689** | 约 **494.6 MiB** | US$0/月 |
| 图片站 `images.freeentry.org` | **4,090** | **413.080 MiB** | US$0/月 |
| 合计 | 两个项目各自低于 20,000 文件 | 约 907.7 MiB | **US$0/月** |

这是在当前产物上拆分的核算值；图片 URL 改为完整域名后，HTML/JS 字节数会有小幅变化。新增路由或响应头配置也可能带来少量文件，距离单项目上限仍有余量。

实施涉及：

1. 主站打包时不包含 `images/museums/` 和 `images/derived/`；图片项目只保留一份全部图片。
2. 使用统一的图片 URL 构造函数，更新静态详情页、React 详情、`srcset`、结构化数据和社交分享图片地址。
3. 检查 Service Worker 图片缓存规则及跨域图片响应；需要时设置 CORS 响应头。
4. 保持 `/france/`、`/italy/`、`/belgium/` 页面 URL 不变，更新部署自动化。

**不需要 R2，也不需要购买对象存储。** 图片规模本身在免费静态项目限制内，两个项目用同一个现有域名的不同子域，不需要再注册第二个域名。

Cloudflare 当前建议新项目优先使用 Workers；这里的两个项目可以使用 Workers Static Assets，已有 Pages 工作流也可以使用 Pages。[Cloudflare Pages 官方入口说明](https://developers.cloudflare.com/pages/)

### 6.3 省事推荐：单个 Workers Paid + Static Assets

该套餐基础费是**每个账户 US$5/月**，静态文件数上限 100,000。当前 CI 的约 22,891 个文件，以及本地全量复制的约 28,959 个文件，都在范围内。

本项目只使用 Static Assets 的情况下：

```text
账户套餐：       US$5.00/月
静态资源存储：   US$0.00
静态资源请求：   US$0.00
静态资源流量：   US$0.00
合计：           US$5.00/月，12 个月 US$60.00（未计可能适用的税费）
```

US$5 是 Workers Paid 的价格，**不是“购买 US$5 就能升级 Pages 文件数”的意思**。如果选这个方案，应部署到 Workers Static Assets；不要误买 Cloudflare 网站 Pro 套餐，也不要把 Workers 的 100,000 文件额度套用到免费 Pages 项目。

如果账户已经在付 Workers Paid 的 US$5 基础费，且没有增加其他计量收费，本静态站的额外托管成本可为 US$0。来源：[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)。

## 7. 阿里云：确切价格与是否值得

本次查到阿里云官方 ECS 活动页列出：

| 项目 | 官方活动配置 / 价格 |
|---|---|
| 实例 | ECS 经济型 e |
| CPU / 内存 | 2 核 / 2 GB |
| 系统盘 | 40 GB ESSD Entry |
| 带宽 | 3 Mbps 固定带宽，不限流量 |
| 活动价 | **人民币 99 元/年** |
| 月均摊 | **99 ÷ 12 = 8.25 元/月**，不代表支持按该价格月付 |
| 页面标示续费规则 | 新老同享、续费同价，价格锁到 2029-03-31 |

来源：[阿里云 99 元 ECS 官方活动页](https://www.aliyun.com/daily-act/ecs/99program)。官方页面标价已核实，但本次没有登录用户账户验证活动购买资格、可选地域和库存，**不能把此价格当作法兰克福/巴黎地域的已确认订单报价**。

这个配置存放整站文件足够，但 3 Mbps = 理论总吞吐 0.375 MB/s，多人并发需要共享。单靠它直接提供图片密集的网站，与 CDN 静态托管的使用体验和维护成本并不等价。还需要自己安装 Web 服务器、配置 HTTPS、更新系统和安排恢复方案。

**本项目不建议为了托管静态文件专门购买 ECS。** 它比零费用方案贵，并增加运维；这个网站服务法国、意大利、比利时内容，也不应仅凭中国站促销金额决定服务器地域。

没有把“阿里云 OSS 每月几毛钱”当作整站报价：OSS 还涉及外网流量、请求、可能的 CDN 回源等费用，且按地域不同。缺少实际地域和流量时，给一个固定总价属于假精确。[OSS 流量计费](https://help.aliyun.com/zh/oss/traffic-fees)

## 8. 下一步建议与核验边界

推荐顺序：

1. **最低现金成本：Cloudflare 两个免费静态项目，总托管费 US$0/月。** 主站与图片拆分，页面 URL 不变，主站还有约 3,311 个文件的余量。
2. **最少部署结构调整：Workers Paid，US$5/月。** 单项目容纳整站，图片去重可以继续做，但不再是上线前必须解决的额度问题。
3. **沿用现有平台：图片按国家裁剪后用 GitHub Pages，US$0/月。** 容量余量较小，持续监控发布体积和月流量。

本次已经完成：现有 `dist` 文件逐项统计、三国 Astro 静态页面重建、图片引用与所有预期 WebP 文件存在性检查，以及官方配额和价格核实。

测量方法及限制：

- 三国构建使用当前已安装的依赖，输出到临时目录，未覆盖原有 `dist`。
- 临时 `--outDir` 构建触发了当前 PWA 集成的输出路径警告，出现 Astro 内部缓存文件及错误位置的 Service Worker。容量核算剔除了 `content-assets.mjs`、`content-modules.mjs`、`data-store.json`、`settings.json`，并在临时产物中按项目缓存策略单独生成 Service Worker。该处理用于容量分析，不等于修改或验证正式发布配置。
- “当前 CI”数据由三国重建产物按现有矩阵任务逻辑筛选图片推算；“优化后”数据按数据集图片引用筛选推算。**它们不是本次从线上 CI 下载的最终 artifact，也不是已完成的迁移验证。** 正式实施时应对最终 `site/` 重新统计，并检查 PWA、404、子目录路由、图片和 sitemap。
- WebP 生成所需的文件全部存在；正式 CI 重新编码和版本差异可能使字节数小幅变化，不影响上述超限判断。
- 未进行 Cloudflare/GitHub 发布或购买操作；本次只新增这份调查文档。

正式发布前可用以下命令直接检查最终目录，不需要依赖 `du` 的磁盘块口径：

```bash
python3 - <<'PY'
from pathlib import Path
root = Path('site')  # 必须是三国组装完成后的最终部署目录
files = [p for p in root.rglob('*') if p.is_file()]
sizes = [(p, p.stat().st_size) for p in files]
total = sum(size for _, size in sizes)
print('files:', len(files))
print('bytes:', total)
print('MiB:', total / 1024**2)
print('largest:', max(sizes, key=lambda item: item[1], default=None))
PY
```
