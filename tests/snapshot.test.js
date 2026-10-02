import test from 'node:test'
import assert from 'node:assert/strict'
import { collectSnapshot, isValidSnapshot, parseSnapshotDocument, renderSnapshotDocument } from '../src/snapshot.js'

const item = { title: '即时可读的新闻', url: 'https://example.com/article', publisherName: '联合早报', channels: [] }
const snapshot = { generatedAt: 1790940000000, news: [item], sources: [{ id: 'example' }], zaobao: { lead: item, latest: [] } }

test('首个 HTML 含正文及可恢复快照，不依赖浏览器缓存或数据请求', () => {
  const html = renderSnapshotDocument('<html><body><main id="app"></main></body></html>', snapshot)
  assert.match(html, /<h3><a[^>]*>即时可读的新闻<\/a><\/h3>/)
  assert.doesNotMatch(html, /正在加载|loading-card|fetch\(/)
  assert.deepEqual(parseSnapshotDocument(html), snapshot)
  assert.equal(isValidSnapshot({ ...snapshot, news: [] }), false)
})

test('内嵌 JSON 中恶意标题不能关闭 script 或注入标记', () => {
  const malicious = { ...snapshot, news: [{ ...item, title: '</script><script>alert(1)</script>' }] }
  const html = renderSnapshotDocument('<main id="app"></main></body>', malicious)
  assert.equal((html.match(/<script/g) || []).length, 1)
  assert.deepEqual(parseSnapshotDocument(html), malicious)
})

test('预取头图只在正文传输一次，静态刷新仍可恢复头图', () => {
  const withImage = { ...snapshot, zaobao: { lead: { ...item, inlineImage: 'data:image/webp;base64,UklGRg==' }, latest: [] } }
  const html = renderSnapshotDocument('<main id="app"></main></body>', withImage)
  assert.equal((html.match(/data:image\/webp/g) || []).length, 1)
  assert.deepEqual(parseSnapshotDocument(html), withImage)
})

test('抓取失败或空数据拒绝发布，防止覆盖最后成功的静态页', async () => {
  await assert.rejects(collectSnapshot({ fetchImpl: async () => { throw new Error('上游超时') } }), /上游超时/)
  await assert.rejects(collectSnapshot({ fetchImpl: async () => ({ ok: true, json: async () => [], text: async () => '' }) }), /为空|不完整/)
})
