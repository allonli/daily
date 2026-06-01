import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/zaobao.js'

test('zaobao API 返回 CDN 缓存头和来源调试头', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => url === 'https://www.zaobao.com/cn'
      ? `
        <a href="/news/world/story20260530-1" data-testid="rotator">
          <img src="https://cdn.example.com/lead.jpg">
          <div title="接口头图">接口头图</div>
        </a>
        <astro-island component-url="RealTimeGroupList.js" props="${JSON.stringify([]).replaceAll('"', '&quot;')}"></astro-island>
      `
      : '<html></html>'
  })

  const headers = {}
  const res = {
    setHeader: (key, value) => {
      headers[key.toLowerCase()] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    send(body) {
      this.body = body
      return this
    }
  }

  try {
    await handler({}, res)
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(res.statusCode, 200)
  assert.equal(headers['vercel-cdn-cache-control'], 'public, s-maxage=180, stale-while-revalidate=900')
  assert.equal(headers['x-zaobao-cache-source'], 'origin')
  assert.match(headers['x-zaobao-fetch-ms'], /^\d+$/)
})
