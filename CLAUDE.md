# CLAUDE

## 项目说明

这是一个 Vite 静态站点，用来复刻 Brave 新标签页的 Brave News 区域，并通过普通 HTTPS 页面解决默认内部页无法被翻译扩展注入的问题。

生产地址：https://allonli.vercel.app/

页面直接读取 Brave News CDN 的 `en_US` feed 和全球 sources 列表，保留新闻列表、频道筛选、发布者分组、自定义来源弹层、刷新重排、隐藏发布者和关注来源覆盖。根域名默认打开“联合早报”，左侧入口只保留联合早报、商业、游戏、科学、头条新闻和最大来源，不显示“为您推荐”“正在关注”“Brave 官方”和“首页”。联合早报通过 `/api/zaobao` 展示早报首页中间头图容器和右侧 `aside-realtime`“最新”列表最多 15 条新闻；线上首页初始数据为空时回退解析 `/realtime` 静态列表。缺图项会预取详情页主图。线上环境通过 `/api/image` 代理清洗 Brave CDN 的 `.pad` 图片，本地开发环境直接使用原始图片地址。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

`npm run dev` 和 `npm run preview` 都默认绑定 `127.0.0.1`。如果改动影响页面交互，至少运行 `npm test` 和 `npm run build`；视觉或交互改动还需要用本地页面做一次手动验收。

## 实现要点

- `src/news.js` 负责拉取 Brave News CDN、合并新闻源信息、筛选 `en_US` 来源和新闻筛选。
- `src/zaobao.js` 负责抓取联合早报 `/cn` 首页、解析 Astro 初始数据、解析 `/realtime` 静态列表、补齐详情页主图、处理浏览器缓存兜底，并供前端、Vercel API 和本地开发代理复用。
- `src/main.js` 负责渲染页面、侧栏折叠、自定义来源弹层、来源接口发布者分组、刷新重排、发布者标签和交互状态。
- `src/styles.css` 负责复刻 Brave 新标签页暗色双栏视觉。
- `api/image.js` 是 Vercel Serverless Function，用于代理图片、裁掉 `.pad` 图片前置填充字节、识别真实图片类型并设置缓存头。
- `api/zaobao.js` 是 Vercel Serverless Function，用于返回联合早报头图和右侧“最新”新闻。
- `vite.config.js` 在本地开发时提供 `/api/zaobao`，便于直接验收早报区块。
- `tests/news.test.js` 和 `tests/zaobao.test.js` 覆盖数据规范化、筛选、刷新缓存参数、中文相对时间、联合早报解析和缺图补齐。

## 状态与数据流

- `fetchNewsBundle()` 并行请求新闻 feed 和 sources，返回 `news` 与 `sources` 两组规范化数据。
- `fetchZaobaoNews()` 请求 `/api/zaobao`；该接口抓取联合早报 `/cn` 首页，优先定位头图容器和右侧 `aside-realtime` 容器，取首页主图和右侧“最新”最多 15 条新闻，若线上首页拿不到右侧初始数据则解析 `/realtime` 静态列表，缺图项再请求详情页读取 JSON-LD 主图。
- 页面首次加载会自动请求 `fetchZaobaoNews()`；右下角刷新按钮会追加缓存参数并重新请求早报接口，没有后台定时轮询。
- 联合早报数据不能只依赖 Vercel CDN 缓存：线上函数设置 `s-maxage`/`stale-while-revalidate`，同时函数进程内保留上一版数据，前端也写入 `zaobaoNewsCacheV1`，接口失败时继续显示上一版。
- 新闻卡片的关注状态由 `sources` 中的默认 `enabled` 和本地 `followOverrides` 合成。
- 推荐流默认按 `score` 和发布时间排序；点击刷新后用时间戳生成伪随机排序，同时给 CDN 请求追加缓存参数。
- `Following` 视图如果没有命中当天 feed，会回退到推荐流，避免关注来源暂时无内容时出现空白。
- 发布者分组基于当前 feed 中真实出现的来源和分类生成，每组只取排名靠前的少量来源。
- 图片 URL 在本地开发环境优先直连；生产环境只把 `pcdn.brave.com` 且路径以 `.pad` 结尾的图片转到 `/api/image`。
- 浏览器本地存储键包括 `hiddenPublishers`、`followOverrides` 和 `collapsedSectionsV3`。

## 注意事项

- 不要直接复用 `chrome://` 资源；这些资源只能在 Brave 内部页面访问。
- 页面部署到 Vercel 后保持为普通 HTTPS 页面，确保翻译类扩展可以注入。
- 关键逻辑保持简明中文注释。
- Brave 的 `sources.global.json` 是全球来源池，当前只展示含 `en_US` locale 的来源；新增频道或来源逻辑时不要把其他 locale 混入主 feed。
- `/api/image` 是 Vercel Serverless Function，本地 Vite 开发服务不会自动提供这个接口。
- `/api/zaobao` 在线上由 Vercel Function 提供，本地由 `vite.config.js` 的开发中间件提供；改动时保持两边共用 `src/zaobao.js`，并保留失败时使用上一版数据的兜底。
- 图片代理只应处理普通 `http:` / `https:` URL，不要扩大到本地文件、内部协议或未验证输入。
