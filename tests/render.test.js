import test from 'node:test'
import assert from 'node:assert/strict'
import { formatSnapshotStatus, proxyImageUrl, renderArticle, renderShellMarkup, renderZaobaoSection, safeRemoteUrl } from '../src/render.js'

const now = new Date('2026-10-02T06:00:00Z')
const newsItem = {
  title: '可立即阅读的新闻', url: 'https://example.com/news?topic=1&source=2',
  imageUrl: 'https://example.com/image.jpg', publisherName: '联合早报', category: 'Science',
  publishedAt: now.getTime() - 10 * 60000, channels: ['联合早报']
}

test('静态 shell 的响应包含新闻、频道和完整交互入口，没有加载占位', () => {
  const feedHtml = renderZaobaoSection({ lead: newsItem, latest: [] }, { now })
  const html = renderShellMarkup({ feedHtml, generatedAt: now.getTime() })

  assert.match(html, /可立即阅读的新闻/)
  assert.match(html, /10分钟前/)
  assert.match(html, /data-channel="Science"/)
  assert.match(html, /data-preset="Zaobao"/)
  assert.equal((html.match(/data-snapshot-status/g) || []).length, 1)
  assert.match(html, /更新于 10\/02 14:00/)
  assert.doesNotMatch(html, /loading-card|正在加载|加载新闻/)
  for (const selector of ['data-feed', 'data-refresh', 'data-channels', 'data-publisher-groups', 'data-customize', 'data-close-customize', 'data-follow-count', 'data-customize-channels', 'data-followed-sources', 'data-customize-heading', 'data-source-grid']) {
    assert.ok(html.includes(selector), `保留交互 selector: ${selector}`)
  }
})

test('远程标题、来源、分类、时间和属性安全转义', () => {
  const payload = '<script>alert("x")</script> & \'测试\''
  const html = renderArticle({ ...newsItem, title: payload, publisherName: payload, category: payload, timeLabel: payload }, 0, { now })

  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;测试&#39;/)
  assert.match(html, /href="https:\/\/example.com\/news\?topic=1&amp;source=2"/)
  assert.match(html, /data-hide-publisher="&lt;script&gt;/)
})

test('拒绝可执行 URL 和任意本站图片路径', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'java\nscript:alert(1)', '//evil.example/image', '/untrusted.svg']) {
    const html = renderArticle({ ...newsItem, url, imageUrl: url }, 0, { production: true, now })
    assert.doesNotMatch(html, /href=|<img /)
    assert.match(html, /aria-disabled="true"/)
    assert.match(html, /image-fallback/)
    assert.equal(safeRemoteUrl(url), '')
  }
  assert.equal(proxyImageUrl('/api/image?url=javascript%3Aalert(1)', { production: true }), '')
})

test('生产 .pad 图片使用受控代理，头图优先加载，后续图片懒加载', () => {
  const imageUrl = 'https://pcdn.brave.com/news/image.pad?version=1'
  const hero = renderArticle({ ...newsItem, imageUrl }, 0, { production: true, now })
  const later = renderArticle(newsItem, 1, { production: true, now })

  assert.match(hero, /src="\/api\/image\?url=https%3A%2F%2Fpcdn\.brave\.com%2Fnews%2Fimage\.pad%3Fversion%3D1"/)
  assert.match(hero, /data-original-src="https:\/\/pcdn.brave.com\/news\/image.pad\?version=1"/)
  assert.match(hero, /loading="eager" fetchpriority="high" decoding="async"/)
  assert.match(later, /src="https:\/\/example.com\/image.jpg"/)
  assert.match(later, /loading="lazy" decoding="async"/)
  assert.doesNotMatch(later, /fetchpriority="high"|lead-card/)
  assert.equal(proxyImageUrl(imageUrl), imageUrl)
  assert.equal(proxyImageUrl('/api/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg', { production: true }), '/api/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg')
})

test('早报去重并尊重隐藏来源，空数据显示明确的空状态', () => {
  const bundle = { lead: newsItem, latest: [newsItem, { ...newsItem, title: '第二条', url: 'https://example.com/second' }] }
  const html = renderZaobaoSection(bundle, { now })

  assert.equal((html.match(/class="news-card /g) || []).length, 2)
  assert.equal((html.match(/lead-card/g) || []).length, 1)
  assert.equal(renderZaobaoSection(bundle, { hiddenPublishers: ['联合早报'], now }), '')
  assert.equal(renderZaobaoSection(null), '')
  assert.equal(renderZaobaoSection({ lead: null, latest: [] }), '')
  assert.match(renderShellMarkup(), /当前分类没有新闻/)
  assert.doesNotMatch(renderShellMarkup(), /正在加载/)
  assert.equal(formatSnapshotStatus('invalid'), '')
  assert.equal(formatSnapshotStatus(0), '')
})
test('预取的头图直接内嵌，拒绝 SVG 或带可执行内容的数据 URL', () => {
  const item = { title: '头图', url: 'https://example.com/news', imageUrl: 'https://example.com/cover.webp', inlineImage: 'data:image/webp;base64,UklGRg==' }
  assert.match(renderArticle(item), /src="data:image\/webp;base64,UklGRg=="/)
  assert.doesNotMatch(renderArticle({ ...item, inlineImage: 'data:image/svg+xml,<svg onload="alert(1)">' }), /src="data:/)
})
