# Brave News New Tab

复刻 Brave 新标签页里的 Brave News 区域，并把新闻提前生成到完整 HTML 中。首次打开直接阅读联合早报，频道切换使用首页内嵌的数据；新闻抓取和页面更新在云端后台完成。

生产地址：[allonli.vercel.app](https://allonli.vercel.app/)

代码仓库：[allonli/daily](https://github.com/allonli/daily)

## 功能

- 首屏展示接近 Brave 原版结构的暗色新闻列表。
- 使用 Brave News 的公开 CDN 数据源和联合早报页面，在构建及后台更新时抓取。
- 保留 Brave 风格的左侧频道栏、默认折叠的分组发布者栏、单列新闻卡片、频道筛选和自定义来源弹层；左侧入口只保留联合早报、商业、游戏、科学、头条新闻和最大来源，每个发布者分组最多展示当前新闻流里有内容且来源排名靠前的 5 家。
- 首次 HTML 已包含正文和新闻快照，不等待浏览器请求新闻接口，也不依赖浏览器里曾经保存的数据；关闭 JavaScript 仍能阅读早报正文并打开文章。
- 右下刷新按钮读取已经生成的首页，更新于时间显示当前版本；没有新版本时提示“已是最新一版”，请求失败时保留当前新闻并可再次点击重试。
- 支持折叠频道、隐藏发布者、关注来源覆盖，并把这些偏好保存在浏览器本地存储。
- 支持按频道浏览来源、查看正在关注来源，并在所有发布者右侧展示媒体定位标签。
- 点击左侧频道、发布者或“联合早报”后，页面立即回到顶部，从第一条新闻开始阅读；展开或折叠分组不会触发回顶。
- 根域名默认打开“联合早报”入口；左侧不再显示“为您推荐”“正在关注”“Brave 官方”和“首页”。联合早报头图优先取首页中间头图容器，下方优先取右侧 `aside-realtime`“最新”列表最多 15 条新闻；线上首页初始数据为空时会回退解析 `/realtime` 静态列表。
- 对联合早报缺图新闻会在后台预取详情页，读取结构化数据里的文章主图。
- 早报首屏头图在后台成功预取后直接内嵌到 HTML，减少打开时的跨站图片等待；仅内嵌不超过 250,000 字节的 JPEG、PNG、WebP 或 AVIF，失败时继续使用原图片地址。
- Vercel ISR 保存最后成功生成的完整页面，缓存过期时仍先返回旧页面，再后台更新；上游失败不会用空白或不完整数据覆盖成功页面。
- GitHub Actions 约每 5 分钟请求首页，触发到期后的后台更新，无需有人打开网站；调度可能延迟，不保证严格每 5 分钟更新。
- 线上环境会通过 `/api/image` 清洗 Brave CDN 的 `.pad` 图片；本地开发环境直接使用原图地址。
- 页面是普通 HTTPS 站点，方便沉浸式翻译等扩展注入。

## 目录结构

- `index.html`：Vite 页面模板，构建时填入 `#app` 正文和 `#news-snapshot` JSON。
- `src/main.js`：渲染新闻页面、侧栏、发布者分组、自定义来源弹层、刷新和本地偏好状态。
- `src/news.js`：后台拉取 Brave News 数据，规范化新闻和来源字段，处理频道筛选与中文相对时间。
- `src/zaobao.js`：抓取并解析联合早报 `/cn` 首页、`/realtime` 静态列表与详情页图片，生成早报入口数据，保留旧版浏览器缓存辅助方法；首页解析优先定位头图容器和右侧 `aside-realtime` 容器，找不到时再用全局兜底。
- `src/snapshot.js`：并行收集两组新闻、预取早报头图、校验完整性、裁剪内嵌新闻、序列化快照和生成完整 HTML。
- `src/snapshot-news.js`：保留每个可见频道的前 72 条候选、侧栏来源的前 36 条新闻及分类代表条目，避免把整份新闻流传给浏览器。
- `src/render.js`：构建与浏览器共用的正文和外壳渲染、文字转义及远程 URL 校验。
- `src/styles.css`：Brave News 风格的暗色界面与响应式布局。
- `scripts/build-static.js`：构建时抓取快照，写入完整 `dist/index.html`、后台模板和开发缓存。
- `scripts/build-output.js`：生成 `.vercel/output`，打包首页 ISR 函数和图片代理，附上构建时的静态首页兜底。
- `server/index.js`：Vercel 后台重新抓取并生成完整 HTML，失败时不发布新页面。
- `api/image.js`：Vercel Serverless Function，代理并清洗 Brave CDN `.pad` 图片。
- `api/zaobao.js`：保留旧版早报接口源码；当前首页不调用该接口，自建部署输出不包含它。
- `vite.config.js`：本地开发时读取有效 `.cache/news.json`，没有缓存时抓取一次，再将快照填入页面。
- `.github/workflows/refresh-news.yml`：每 5 分钟请求生产首页，也支持手动运行。
- `tests/`：覆盖新闻解析、筛选、HTML 转义、快照完整性及 Vercel 构建输出，并提供浏览器验收剧本。

## 本地运行

```bash
npm install
npm run dev
```

开发服务默认绑定 `127.0.0.1`。启动后按终端输出的地址访问页面。首次开发且没有有效缓存时，需要网络抓取新闻；后续启动复用 `.cache/news.json`。需要重新抓取开发数据时，删除该缓存文件后重启开发服务。

构建后如需本地预览静态产物：

```bash
npm run preview
```

本地预览只提供 `dist` 静态文件，不运行 Vercel ISR 或 `/api/image`。云端后台更新需要部署到 Vercel；预览页面的刷新按钮只能读到这次构建的快照。

## 测试与构建

```bash
npm test
npm run build
```

`npm run build` 先运行 Vite，再通过网络抓取新闻，生成完整首页及 `.vercel/output`。抓取失败或数据不完整会让构建失败，应恢复网络或上游后重新运行，保留已上线的成功版本。

静态首屏、刷新恢复和云端更新的浏览器验收步骤见 [tests/static-news-acceptance.md](tests/static-news-acceptance.md)。分类切换回顶的回归步骤见 [tests/scroll-navigation.md](tests/scroll-navigation.md)。

## 云端更新

- `vercel.json` 使用 `npm run build` 和自定义 Build Output API；首页及 `/index.html` 路由到同一个 ISR 页面。
- ISR 缓存有效期为 240 秒。首次没有运行时缓存时立即返回构建时预抓的完整首页，并在后台生成新版本；到期后也先返回最后成功页面。
- 当前 Vercel Hobby 套餐的原生 cron 只允许每天一次，所以这里使用 GitHub Actions，不新增付费服务，也不为每次新闻更新重新部署。
- workflow 在默认分支生效，调度为 `2-57/5 * * * *`，即每小时第 2、7、12……57 分钟；可在仓库 Actions 中运行 **Refresh static news → Run workflow**。
- Actions 的成功记录表示首页请求成功，后台抓取是否已完成还需查看页面“更新于”时间或响应头 `x-news-generated-at`。GitHub 调度可能延迟，公开仓库 60 天无活动时也可能自动停用；可在 Actions 中重新启用并手动运行。[GitHub 调度说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## 数据源

- 新闻列表：`https://brave-today-cdn.brave.com/brave-today/feed.en_USjson`
- 新闻源：`https://brave-today-cdn.brave.com/sources.global.json`

## 实现说明

- 推荐流保留按 `score` 和发布时间排序的规则；刷新操作用于读取云端新快照。
- 两组新闻共同组成一份有效快照；构建和 ISR 更新均验证完整性，上游失败时保留上一版成功的云端页面。
- 首次打开、频道切换和自定义来源不请求新闻数据。手动刷新只读取本站 `/` 的 HTML，并解析其中的 JSON 快照，不直接抓取上游或调用 `/api/zaobao`。
- 内嵌快照保留每个可见频道前 72 条候选、侧栏发布者前 36 条新闻和分类代表条目，同时保留完整 `en_US` 来源信息；页面仍按现有规则显示最多 36 张 Brave 新闻卡片。
- `Following` 视图来自 Brave 来源列表的 `enabled` 状态和用户在弹层里的本地覆盖；如果当天新闻流没有命中关注来源，会回退到推荐流，避免空页面。
- 隐藏发布者、关注覆盖和折叠状态分别写入 `hiddenPublishers`、`followOverrides`、`collapsedSectionsV3`。
- Brave 的 `sources.global.json` 是全球来源池，当前代码只保留含 `en_US` locale 的来源。
- `/api/image` 只在 Vercel 部署环境中可用；本地 Vite 开发服务不会启动这个 Serverless Function。
- 不要直接依赖 `chrome://` 或 Brave 内部资源；页面需要保持普通 HTTPS 站点，方便浏览器扩展注入。
