# CLAUDE

## 项目说明

这是一个 Vite 静态站点，用来复刻 Brave 新标签页的 Brave News 区域，并通过普通 HTTPS 页面解决默认内部页无法被翻译扩展注入的问题。

生产地址：https://allonli.vercel.app/

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
```

## 实现要点

- `src/news.js` 负责拉取 Brave News CDN、合并新闻源信息、筛选 `en_US` 来源和新闻筛选。
- `src/main.js` 负责渲染页面、侧栏折叠、自定义来源弹层、来源接口发布者分组、刷新重排、发布者标签和交互状态。
- `src/styles.css` 负责复刻 Brave 新标签页暗色双栏视觉。

## 注意事项

- 不要直接复用 `chrome://` 资源；这些资源只能在 Brave 内部页面访问。
- 页面部署到 Vercel 后保持为普通 HTTPS 页面，确保翻译类扩展可以注入。
- 关键逻辑保持简明中文注释。
