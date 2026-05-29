# Brave News New Tab

复刻 Brave 新标签页里的 Brave News 区域，并把新闻列表提前到首屏展示。页面直接读取 Brave News CDN 数据，部署到 Vercel 后作为普通 HTTPS 页面访问。

生产地址：https://allonli.vercel.app/

## 功能

- 首屏展示接近 Brave 原版结构的暗色新闻列表。
- 使用 Brave News 的公开 CDN 数据源。
- 保留 Brave 风格的左侧频道栏、默认折叠的分组发布者栏、单列新闻卡片、频道筛选和自定义来源弹层；每个发布者分组只展示当前新闻流里有内容且来源排名靠前的 3-5 家。
- 右下刷新按钮会重新请求 Brave News 数据接口，并在推荐流中换一批展示顺序。
- 支持折叠频道，并在所有发布者右侧展示媒体定位标签。
- 页面是普通 HTTPS 站点，方便沉浸式翻译等扩展注入。

## 本地运行

```bash
npm install
npm run dev
```

## 测试与构建

```bash
npm test
npm run build
```

## 数据源

- 新闻列表：`https://brave-today-cdn.brave.com/brave-today/feed.en_USjson`
- 新闻源：`https://brave-today-cdn.brave.com/sources.global.json`
