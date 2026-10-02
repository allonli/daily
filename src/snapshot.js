import { compactSnapshotNews } from './snapshot-news.js'
import { fetchNewsBundle } from './news.js'
import { buildZaobaoSectionItems, collectZaobaoNews } from './zaobao.js'
import { renderShellMarkup, renderZaobaoSection } from './render.js'

export async function collectSnapshot({ fetchImpl = fetch, now = Date.now } = {}) {
  const boundedFetch = (url, options = {}) => fetchImpl(url, {
    ...options, signal: AbortSignal.timeout(12000)
  })
  const [bundle, zaobao] = await Promise.all([
    fetchNewsBundle({ fetchImpl: boundedFetch }),
    collectZaobaoNews({ fetchImpl: boundedFetch })
  ])
  // 首屏头图一起预取，打开页面时不再等待境外图片域名。
  if (zaobao.lead?.imageUrl) {
    try {
      const response = await boundedFetch(zaobao.lead.imageUrl)
      const type = response.headers.get('content-type')?.split(';')[0]
      if (response.ok && ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) {
        const bytes = await response.arrayBuffer()
        if (bytes.byteLength <= 250000) {
          zaobao.lead = { ...zaobao.lead, inlineImage: `data:${type};base64,${Buffer.from(bytes).toString('base64')}` }
        }
      }
    } catch {
      // 头图失败不阻止文字新闻发布，仍可使用原始图片与浏览器兜底。
    }
  }
  const snapshot = { generatedAt: now(), ...bundle, news: compactSnapshotNews(bundle.news, bundle.sources), zaobao }
  // 失败时不发布空白或不完整的一版，让 CDN 保留上一份成功页面。
  if (!isValidSnapshot(snapshot)) {
    throw new Error('新闻快照不完整，保留上一版页面')
  }
  return snapshot
}

export function isValidSnapshot(snapshot) {
  return Number.isFinite(snapshot?.generatedAt) && snapshot.generatedAt > 0
    && Array.isArray(snapshot.news) && snapshot.news.length > 0
    && Array.isArray(snapshot.sources) && snapshot.sources.length > 0
    && buildZaobaoSectionItems(snapshot.zaobao).length > 0
}

export function serializeSnapshot(snapshot) {
  // 新闻标题不能提前关闭 JSON script，服务端 HTML 与客户端共用此快照。
  return JSON.stringify(snapshot, (key, value) => key === 'inlineImage' ? undefined : value)
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}

export function renderSnapshotDocument(template, snapshot, { production = true } = {}) {
  if (!isValidSnapshot(snapshot)) {
    throw new Error('新闻快照不完整')
  }
  const feedHtml = renderZaobaoSection(snapshot.zaobao, {
    production, generatedAt: snapshot.generatedAt, now: new Date(snapshot.generatedAt)
  })
  const shell = renderShellMarkup({ feedHtml, generatedAt: snapshot.generatedAt })
  return template.replace('<main id="app"></main>', `<main id="app">${shell}</main>`)
    .replace('</body>', `<script id="news-snapshot" type="application/json">${serializeSnapshot(snapshot)}</script>\n</body>`)
}

export function parseSnapshotDocument(html) {
  const match = html.match(/<script id="news-snapshot" type="application\/json">([\s\S]*?)<\/script>/)
  const snapshot = match ? JSON.parse(match[1]) : null
  if (!isValidSnapshot(snapshot)) {
    throw new Error('静态页面未包含有效新闻快照')
  }
  // 头图只在 HTML 保存一次，刷新时恢复到数据里，避免重复传输图片字节。
  const inlineImage = html.match(/<img src="(data:image\/(?:jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+)"/)?.[1]
  if (inlineImage && snapshot.zaobao.lead) {
    snapshot.zaobao.lead.inlineImage = inlineImage
  }
  return snapshot
}
