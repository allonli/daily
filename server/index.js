import { readFile } from 'node:fs/promises'
import { collectSnapshot, renderSnapshotDocument } from '../src/snapshot.js'

export default async function handler(_req, res) {
  const template = await readFile(new URL('./template.html', import.meta.url), 'utf8')
  // 此函数只负责后台再生成；正常访问由 Vercel 的持久静态页面缓存响应。
  const snapshot = await collectSnapshot()
  const html = renderSnapshotDocument(template, snapshot)
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('x-news-generated-at', new Date(snapshot.generatedAt).toISOString())
  res.statusCode = 200
  res.end(html)
}
