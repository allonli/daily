# CLAUDE

## 项目说明

这是一个 Vite 新闻站点，用来复刻 Brave 新标签页的 Brave News 区域，并通过普通 HTTPS 页面解决默认内部页无法被翻译扩展注入的问题。新闻提前写入完整 HTML，Vercel ISR 在后台更新；保持首次打开即可阅读的行为。

生产地址：https://allonli.vercel.app/

后台读取 Brave News CDN 的 `en_US` feed 和全球 sources 列表，保留新闻列表、频道筛选、发布者分组、自定义来源弹层、静态快照刷新、隐藏发布者和关注来源覆盖。根域名默认打开“联合早报”，左侧入口只保留联合早报、商业、游戏、科学、头条新闻和最大来源，不显示“为您推荐”“正在关注”“Brave 官方”和“首页”。早报收集器抓取首页中间头图容器和右侧 `aside-realtime`“最新”列表最多 15 条新闻；初始数据为空时回退解析 `/realtime` 静态列表，缺图项预取详情页主图。新首页不请求 `/api/zaobao`。线上通过 `/api/image` 代理清洗 Brave CDN 的 `.pad` 图片，本地开发优先使用原始图片地址。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

`npm run dev` 和 `npm run preview` 都默认绑定 `127.0.0.1`。开发服务读取有效 `.cache/news.json`，没有缓存时启动阶段抓取一次；删除缓存并重启可更新开发数据。`npm run build` 需要网络，依次执行 Vite、新闻快照生成及 Vercel Build Output 打包，产生 `dist` 和 `.vercel/output`。上游失败时构建失败，不发布不完整页面。

`npm run preview` 只提供本次构建的静态文件，不运行 ISR 和 `/api/image`，刷新仍是本次构建版本。改动影响页面交互时，运行 `npm test`、`npm run build`，并执行 `tests/static-news-acceptance.md` 的真实浏览器剧本；分类切换回顶继续执行 `tests/scroll-navigation.md`。

## 实现要点

- `src/news.js` 负责拉取 Brave News CDN、合并新闻源信息、筛选 `en_US` 来源和新闻筛选。
- `src/zaobao.js` 负责抓取联合早报 `/cn` 首页、解析 Astro 初始数据、解析 `/realtime` 静态列表、补齐详情页主图；保留旧版接口及浏览器缓存辅助方法。
- `src/snapshot.js` 负责并行收集两组新闻、限制请求耗时、预取早报头图、验证完整性、选择内嵌新闻、序列化 JSON 和完整 HTML。完整来源池仍保留，不能因压缩快照丢失来源定制功能。
- `src/snapshot-news.js` 与客户端共用发布者分组规则，保留可见频道前 72 条、侧栏来源前 36 条及分类代表条目，去重后按原始 feed 顺序输出。
- `src/render.js` 为后台和浏览器共用正文及外壳标记，转义远程文字、限制链接协议，并确保首个 HTML 已含正文。
- `src/main.js` 从 `#news-snapshot` 初始化数据，负责侧栏折叠、频道和来源筛选、自定义来源、手动快照刷新及本地偏好。首次加载不执行数据 fetch；不要增加访问时的新闻接口请求。
- 左侧频道、预设入口和发布者的点击处理在 `renderFeed()` 后立即将页面滚动到顶部；不要把滚动重置放进通用渲染函数，否则后台更新、隐藏来源和关注变更会打断阅读。
- `src/styles.css` 负责复刻 Brave 新标签页暗色双栏视觉。
- `api/image.js` 是 Vercel Serverless Function，用于代理图片、裁掉 `.pad` 图片前置填充字节、识别真实图片类型并设置缓存头。
- `api/zaobao.js` 保留旧版早报接口源码；当前首页不调用，自建部署输出不打包该接口。
- `vite.config.js` 在开发服务启动时准备一份有效快照，通过 `transformIndexHtml` 填入正文和内嵌 JSON。
- `scripts/build-static.js` 抓取有效数据并生成 `dist/index.html`、`dist/template.html` 和 `.cache/news.json`。
- `scripts/build-output.js` 将客户端资源复制到 `.vercel/output/static`，打包 `index.func` 和 `api/image.func`；首页模板及 fallback 放入非公开的函数目录。
- `server/index.js` 读取同层 `template.html`，后台收集快照并生成 HTML，返回 `x-news-generated-at`；失败时抛错，让 ISR 保存旧页面。
- `tests/news.test.js`、`tests/zaobao.test.js` 覆盖解析及筛选；`tests/render.test.js`、`tests/snapshot.test.js` 覆盖首屏正文、远程内容转义、有效快照和失败保护；`tests/snapshot-news.test.js` 验证裁剪后的频道顺序、来源入口和完整来源池；`tests/build-output.test.js` 验证部署目录与真实打包函数。

## 状态与数据流

- `collectSnapshot()` 并行执行 `fetchNewsBundle()` 和 `collectZaobaoNews()`，得到 `{ generatedAt, news, sources, zaobao }`；所有数据完整才允许发布。
- `renderSnapshotDocument()` 将早报正文填入 `#app`，再内嵌 `#news-snapshot` JSON。序列化必须转义 `<`、`>`、`&`，避免远程标题提前关闭 script；HTML 渲染也必须转义文字并校验远程 URL。
- 早报头图可预取到 `inlineImage` data URI，限制为 JPEG、PNG、WebP、AVIF 和 250,000 字节以内；渲染器再次校验 data URI 格式。预取失败不阻止文字发布，保留 `imageUrl` 用于原图及图片失败兜底。
- 内嵌新闻保留常用频道、侧栏来源和分类代表条目，来源信息完整保留；裁剪时必须保证原有频道和发布者仍有代表性内容。
- JavaScript 初始化只绑定交互并应用本地偏好，读取 HTML 快照；无本地缓存的新用户也能立即看到正文。没有 JavaScript 时仍可阅读和打开文章。
- 手动刷新只 `fetch('/')` 读取当前生成的 HTML，然后验证并解析快照；有新时间戳才更新内容。请求失败时提示重试，保留新闻、当前频道和阅读位置，不直接抓取上游。
- 新闻卡片的关注状态由 `sources` 中的默认 `enabled` 和本地 `followOverrides` 合成。
- 推荐流保留按 `score` 和发布时间排序的规则；刷新操作用于读取云端新快照。
- `Following` 视图如果没有命中当天 feed，会回退到推荐流，避免关注来源暂时无内容时出现空白。
- 发布者分组基于当前 feed 中真实出现的来源和分类生成，每组只取排名靠前的少量来源。
- 图片 URL 在本地开发环境优先直连；生产环境只把 `pcdn.brave.com` 且路径以 `.pad` 结尾的图片转到 `/api/image`。
- 浏览器本地存储键包括 `hiddenPublishers`、`followOverrides` 和 `collapsedSectionsV3`。

## 云端部署与调度

- `vercel.json` 的 `framework: null` 和 `buildCommand: npm run build` 让自建 `.vercel/output` 接管部署；首次本地构建部署使用 `vercel deploy --prebuilt --prod`。
- Build Output API v3 的 `/` 和 `/index.html` 指向 `/index` ISR，`expiration: 240`、`allowQuery: []`。不为随机查询参数建立新的首页缓存。
- `index.prerender-fallback.html` 来自构建时预抓的完整首页。没有运行时缓存时先返回 fallback，并在后台再生成；到期后继续返回最后成功页面，在后台更新。不能把首次用户变成抓取新闻的等待者。
- 当前 Vercel Hobby 原生 cron 只允许每天一次，项目不配置原生 cron；`.github/workflows/refresh-news.yml` 在默认分支通过 `2-57/5 * * * *` 每约 5 分钟 GET 生产首页。Actions 可以延迟，公开仓库 60 天无活动也可能被停用。
- workflow 不携带 Authorization、不创建数据库或 Blob，也不为每次更新重新部署；`workflow_dispatch` 支持手动验收。Actions 成功只证明请求成功，须再比较正文快照时间确认后台生成完成。
- Vercel ISR 负责持久保存页面，不依赖函数进程内变量或浏览器 localStorage 保存新闻。普通 CDN 命中和真正完成新版本再生成是不同验收项。

## 注意事项

- 不要直接复用 `chrome://` 资源；这些资源只能在 Brave 内部页面访问。
- 页面部署到 Vercel 后保持为普通 HTTPS 页面，确保翻译类扩展可以注入。
- 关键逻辑保持简明中文注释。
- Brave 的 `sources.global.json` 是全球来源池，当前只展示含 `en_US` locale 的来源；新增频道或来源逻辑时不要把其他 locale 混入主 feed。
- `/api/image` 是 Vercel Serverless Function，本地 Vite 开发服务不会自动提供这个接口。
- 不要将保留的旧版 `fetchZaobaoNews()` 或 `/api/zaobao` 重新接入新首页；后台统一使用 `collectSnapshot()`。本地预览不能验证云端 ISR 更新，必须检查生产页面版本时间、缓存响应及 Actions 运行。
- 图片代理只应处理普通 `http:` / `https:` URL，不要扩大到本地文件、内部协议或未验证输入。
