# Brave News New Tab

复刻 Brave 新标签页里的 Brave News 区域，并把新闻列表提前到首屏展示。页面直接读取 Brave News CDN 数据，部署到 Vercel 后作为普通 HTTPS 页面访问。

生产地址：https://allonli.vercel.app/

## 功能

- 首屏展示接近 Brave 原版结构的暗色新闻列表。
- 使用 Brave News 的公开 CDN 数据源。
- 保留 Brave 风格的左侧频道栏、默认折叠的分组发布者栏、单列新闻卡片、频道筛选和自定义来源弹层；左侧入口只保留联合早报、商业、游戏、科学、头条新闻和最大来源，每个发布者分组只展示当前新闻流里有内容且来源排名靠前的 3-5 家。
- 右下刷新按钮会重新请求 Brave News 数据接口，并在推荐流中换一批展示顺序；联合早报使用稳定缓存键，避免手动刷新绕过 CDN。
- 支持折叠频道、隐藏发布者、关注来源覆盖，并把这些偏好保存在浏览器本地存储。
- 支持按频道浏览来源、查看正在关注来源，并在所有发布者右侧展示媒体定位标签。
- 根域名默认打开“联合早报”入口；左侧不再显示“为您推荐”“正在关注”“Brave 官方”和“首页”。联合早报头图优先取首页中间头图容器，下方优先取右侧 `aside-realtime`“最新”列表最多 15 条新闻；线上首页初始数据为空时会回退解析 `/realtime` 静态列表。
- 对联合早报缺图新闻会预取详情页，读取结构化数据里的文章主图后再返回给前端。
- 联合早报数据带四层兜底：Vercel Cron 每分钟预热、Vercel CDN 短缓存、函数进程内上一版数据、浏览器 localStorage 上一版数据，避免上游偶发失败时刷新后消失。
- 线上环境会通过 `/api/image` 清洗 Brave CDN 的 `.pad` 图片；本地开发环境直接使用原图地址。
- 页面是普通 HTTPS 站点，方便沉浸式翻译等扩展注入。

## 目录结构

- `index.html`：Vite 页面入口，挂载 `#app`。
- `src/main.js`：渲染新闻页面、侧栏、发布者分组、自定义来源弹层、刷新和本地偏好状态。
- `src/loading.js`：生成联合早报首次加载时的动态骨架屏。
- `src/news.js`：拉取 Brave News 数据，规范化新闻和来源字段，处理频道筛选与中文相对时间。
- `src/zaobao.js`：抓取并解析联合早报 `/cn` 首页、`/realtime` 静态列表与详情页图片，生成早报入口数据，并处理浏览器缓存兜底；首页解析优先定位头图容器和右侧 `aside-realtime` 容器，找不到时再用全局兜底。
- `src/styles.css`：Brave News 风格的暗色界面与响应式布局。
- `api/image.js`：Vercel Serverless Function，代理并清洗 Brave CDN `.pad` 图片。
- `api/zaobao.js`：Vercel Serverless Function，返回联合早报头图和右侧“最新”新闻。
- `vercel.json`：配置每分钟请求 `/api/zaobao`，预热生产环境里首页会使用的同一个 CDN 缓存键。
- `vite.config.js`：本地开发时提供 `/api/zaobao`，让页面可以直接验收早报区块。
- `tests/news.test.js`、`tests/zaobao.test.js`、`tests/loading.test.js`、`tests/zaobao-api.test.js`、`tests/vercel-config.test.js`：覆盖数据规范化、频道筛选、刷新缓存参数、相对时间格式、联合早报加载态、解析补图、API 缓存头和 Vercel Cron 配置。

## 本地运行

```bash
npm install
npm run dev
```

开发服务默认绑定 `127.0.0.1`。启动后按终端输出的地址访问页面。

构建后如需本地预览静态产物：

```bash
npm run preview
```

## 测试与构建

```bash
npm test
npm run build
```

## 数据源

- 新闻列表：`https://brave-today-cdn.brave.com/brave-today/feed.en_USjson`
- 新闻源：`https://brave-today-cdn.brave.com/sources.global.json`

## 实现说明

- 推荐流默认按 `score` 和发布时间排序；点击刷新后会用本次刷新时间生成稳定的伪随机排序。
- “联合早报”入口独立于 Brave News 数据；早报接口失败时不影响 Brave 推荐流加载，并优先保留上一版早报数据。
- 联合早报会在页面加载时先读取浏览器本地上一版数据并立即渲染，再后台请求 `/api/zaobao` 更新；点击右下角刷新按钮不会给早报接口追加缓存破坏参数，不需要日常手动更新。
- `Following` 视图来自 Brave 来源列表的 `enabled` 状态和用户在弹层里的本地覆盖；如果当天新闻流没有命中关注来源，会回退到推荐流，避免空页面。
- 隐藏发布者、关注覆盖和折叠状态分别写入 `hiddenPublishers`、`followOverrides`、`collapsedSectionsV3`。
- Brave 的 `sources.global.json` 是全球来源池，当前代码只保留含 `en_US` locale 的来源。
- `/api/image` 只在 Vercel 部署环境中可用；本地 Vite 开发服务不会启动这个 Serverless Function。
- 不要直接依赖 `chrome://` 或 Brave 内部资源；页面需要保持普通 HTTPS 站点，方便浏览器扩展注入。
