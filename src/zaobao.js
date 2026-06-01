const ZAOBAO_ORIGIN = 'https://www.zaobao.com'
const ZAOBAO_HOME_URL = `${ZAOBAO_ORIGIN}/cn`
const ZAOBAO_REALTIME_URL = `${ZAOBAO_ORIGIN}/realtime`
const ZAOBAO_IMAGE_ORIGIN = 'https://dss0.zbstatic5.com/s3fs-public'
const DEFAULT_IMAGE_MARKER = '/pic-default.'
export const ZAOBAO_CACHE_KEY = 'zaobaoNewsCacheV1'

export async function fetchZaobaoNews(options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  const storage = options.storage || globalThis.localStorage
  const requestUrl = options.refresh
    ? `/api/zaobao?refresh=1&t=${encodeURIComponent(options.cacheBust || Date.now())}`
    : '/api/zaobao'
  const requestOptions = options.refresh ? { cache: 'no-store' } : {}

  try {
    const response = await fetchImpl(requestUrl, requestOptions)
    if (!response.ok) {
      throw new Error(`联合早报请求失败：${response.status}`)
    }

    const data = await response.json()
    writeZaobaoCache(storage, data)
    return data
  } catch (error) {
    const cached = readZaobaoCache(storage)
    if (cached) {
      return cached
    }

    throw error
  }
}

export function getCachedZaobaoNews(storage = globalThis.localStorage) {
  return readZaobaoCache(storage)
}

export async function collectZaobaoNews(options = {}) {
  const fetchImpl = options.fetchImpl || fetch
  try {
    const homeResponse = await fetchImpl(ZAOBAO_HOME_URL, requestHeaders())

    if (!homeResponse.ok) {
      throw new Error(`联合早报首页请求失败：${homeResponse.status}`)
    }

    let parsed = parseZaobaoHome(await homeResponse.text())
    if (!parsed.latest.length) {
      parsed = promoteRealtimeFallback(parsed.lead, await fetchZaobaoRealtimeItems(fetchImpl))
    } else if (!parsed.lead) {
      parsed = promoteRealtimeFallback(null, parsed.latest)
    }

    const data = await hydrateZaobaoBundle(parsed, fetchImpl)

    if (!hasZaobaoItems(data)) {
      throw new Error('联合早报解析结果为空')
    }

    return data
  } catch (error) {
    if (hasZaobaoItems(options.fallback)) {
      return options.fallback
    }

    throw error
  }
}

export function parseZaobaoHome(html) {
  const lead = parseTargetLeadArticle(html) || parseLeadArticle(html)
  const latest = parseAsideRealtimeItems(html)

  return { lead, latest }
}

export function parseZaobaoRealtimePage(html) {
  const seen = new Set()
  const items = []

  for (const match of html.matchAll(/<a\b(?=[^>]*href=["']([^"']*\/news\/[^"']*story[^"']*)["'])([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (items.length >= 16) {
      break
    }

    const href = match[1]
    const body = match[3]
    const url = absoluteUrl(href)
    if (seen.has(url)) {
      continue
    }

    const timeLabel = stripTags(body.match(/<span\b(?=[^>]*text-red-500)[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '')
    const articleTitle = stripTags(body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || '')
    const title = articleTitle || stripLeadingTime(stripTags(body), timeLabel)
    const normalized = normalizeZaobaoItem({
      title,
      url,
      imageUrl: readAttribute(body.match(/<img\b([^>]*)>/i)?.[1] || '', 'src'),
      category: categoryFromUrl(href),
      publicationDate: dateFromUrlAndTime(href, timeLabel),
      timeLabel
    })

    if (normalized.title && normalized.url) {
      items.push(normalized)
      seen.add(url)
    }
  }

  return items
}

export async function completeZaobaoImages(items, fetchImpl = fetch) {
  return Promise.all(items.map(async (item) => {
    if (item.imageUrl || !item.url) {
      return item
    }

    try {
      const response = await fetchImpl(item.url, requestHeaders())
      if (!response.ok) {
        return item
      }

      const imageUrl = extractArticleImage(await response.text())
      return imageUrl ? { ...item, imageUrl } : item
    } catch {
      return item
    }
  }))
}

export function extractArticleImage(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(decodeHtml(match[1]).trim())
      const imageUrl = imageFromStructuredData(data)
      if (isUsableImage(imageUrl)) {
        return imageUrl
      }
    } catch {
      // 早报页面可能有其他 JSON-LD；解析失败时继续找下一个。
    }
  }

  const ogImage = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i)?.[1]
  return isUsableImage(ogImage) ? decodeHtml(ogImage) : ''
}

export function buildZaobaoSectionItems(bundle = {}) {
  if (!bundle) {
    return []
  }

  const seen = new Set()
  const items = []

  if (bundle.lead?.url) {
    items.push(bundle.lead)
    seen.add(bundle.lead.url)
  }

  for (const item of bundle.latest || []) {
    if (!item?.url || seen.has(item.url) || items.length >= 16) {
      continue
    }

    items.push(item)
    seen.add(item.url)
  }

  return items
}

function readZaobaoCache(storage) {
  try {
    const payload = storage?.getItem(ZAOBAO_CACHE_KEY)
    if (!payload) {
      return null
    }

    const parsed = JSON.parse(payload)
    return hasZaobaoItems(parsed.data) ? parsed.data : null
  } catch {
    return null
  }
}

function writeZaobaoCache(storage, data) {
  if (!hasZaobaoItems(data)) {
    return
  }

  try {
    storage?.setItem(ZAOBAO_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // 浏览器可能禁用本地存储；不影响当前新闻渲染。
  }
}

function hasZaobaoItems(data) {
  return Boolean(data?.lead?.url || data?.latest?.length)
}

async function fetchZaobaoRealtimeItems(fetchImpl) {
  const response = await fetchImpl(ZAOBAO_REALTIME_URL, requestHeaders())
  if (!response.ok) {
    return []
  }

  return parseZaobaoRealtimePage(await response.text())
}

function promoteRealtimeFallback(lead, realtimeItems) {
  if (!realtimeItems.length) {
    return { lead, latest: [] }
  }

  if (lead?.url) {
    return {
      lead,
      latest: realtimeItems.filter((item) => item.url !== lead.url).slice(0, 15)
    }
  }

  return {
    lead: { ...realtimeItems[0], category: '头图' },
    latest: realtimeItems.slice(1, 16)
  }
}

async function hydrateZaobaoBundle(bundle, fetchImpl) {
  const ordered = []
  if (bundle.lead?.url) {
    ordered.push(bundle.lead)
  }

  for (const item of bundle.latest || []) {
    if (item?.url && !ordered.some((entry) => entry.url === item.url) && ordered.length < 16) {
      ordered.push(item)
    }
  }

  const hydrated = await completeZaobaoImages(ordered, fetchImpl)
  return {
    lead: hydrated[0] || null,
    latest: hydrated.slice(bundle.lead?.url ? 1 : 0, bundle.lead?.url ? 16 : 15)
  }
}

function parseTargetLeadArticle(html) {
  const container = findElementHtml(html, 'div', (attrs) => hasClassTokens(attrs, ['order-1', 'lg:order-2', 'relative']))
  return container ? parseLeadArticle(container) : null
}

function parseLeadArticle(html) {
  const anchor = html.match(/<a\b(?=[^>]*data-testid=["']rotator["'])([^>]*)>([\s\S]*?)<\/a>/i)
  if (!anchor) {
    return null
  }

  const href = readAttribute(anchor[1], 'href')
  const body = anchor[2]
  const title = readAttribute(body, 'title') || stripTags(body)
  const imageUrl = readAttribute(body.match(/<img\b([^>]*)>/i)?.[1] || '', 'src')

  return normalizeZaobaoItem({
    title,
    url: href,
    imageUrl,
    category: '头图',
    publicationDate: ''
  })
}

function parseAsideRealtimeItems(html) {
  const container = findElementHtml(html, 'div', (attrs) => readAttribute(attrs, 'data-testid') === 'aside-realtime')
    || findElementHtml(html, 'div', (attrs) => hasClassTokens(attrs, ['order-130']))
  const targetedItems = container ? parseRealtimeItems(container) : []
  return targetedItems.length ? targetedItems : parseRealtimeItems(html)
}

function parseRealtimeItems(html) {
  const propsAttr = html.match(/<astro-island\b(?=[^>]*RealTimeGroupList)[^>]*\sprops=["']([^"']+)["']/i)?.[1]
  if (!propsAttr) {
    return []
  }

  try {
    const props = decodeAstroValue(JSON.parse(decodeHtml(propsAttr)))
    const firstGroup = props.initialData?.[0]
    return (firstGroup?.data || [])
      .map((item) => normalizeZaobaoItem({
        title: item.displayHeadline || item.title,
        url: item.url,
        imageUrl: imageFromPictures(item.pictures),
        category: item.mainSitemapName || item.sitemapDTO?.shortName || '联合早报',
        publicationDate: item.publicationDate || item.createTime,
        timeLabel: item.serverTime
      }))
      .filter((item) => item.title && item.url)
      .slice(0, 15)
  } catch {
    return []
  }
}

function normalizeZaobaoItem(item) {
  return {
    id: absoluteUrl(item.url),
    publisherId: 'zaobao',
    publisherName: '联合早报',
    title: decodeHtml(String(item.title || '').trim()),
    url: absoluteUrl(item.url),
    imageUrl: absoluteImageUrl(item.imageUrl),
    category: item.category || '联合早报',
    channels: ['联合早报'],
    faviconUrl: '',
    publishedAt: parseZaobaoTime(item.publicationDate),
    score: 0,
    isNew: false,
    isFollowed: true,
    timeLabel: item.timeLabel || ''
  }
}

function categoryFromUrl(url) {
  const category = decodeHtml(url).match(/\/news\/([^/]+)/)?.[1]
  return {
    china: '中国',
    world: '国际',
    singapore: '新加坡',
    sea: '东南亚'
  }[category] || '联合早报'
}

function stripLeadingTime(text, timeLabel) {
  if (timeLabel && text.startsWith(timeLabel)) {
    return text.slice(timeLabel.length).trim()
  }

  return text.replace(/^(\d{1,2}:\d{2}|\d+分钟前|今天|昨天)\s*/, '').trim()
}

function dateFromUrlAndTime(url, timeLabel) {
  const date = decodeHtml(url).match(/story(\d{4})(\d{2})(\d{2})-/)
  const time = timeLabel?.match(/^(\d{1,2}):(\d{2})$/)
  if (!date || !time) {
    return ''
  }

  return `${date[1]}-${date[2]}-${date[3]} ${time[1].padStart(2, '0')}:${time[2]}:00`
}

function findElementHtml(html, tagName, predicate) {
  const openTag = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi')
  let match

  while ((match = openTag.exec(html))) {
    if (predicate(match[1])) {
      return sliceBalancedElement(html, tagName, match.index)
    }
  }

  return ''
}

function sliceBalancedElement(html, tagName, startIndex) {
  const tag = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi')
  tag.lastIndex = startIndex
  let depth = 0
  let match

  while ((match = tag.exec(html))) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) {
        return html.slice(startIndex, tag.lastIndex)
      }
    } else {
      depth += 1
    }
  }

  return html.slice(startIndex)
}

function hasClassTokens(attrs, tokens) {
  const classes = new Set(readAttribute(attrs, 'class').split(/\s+/).filter(Boolean))
  return tokens.every((token) => classes.has(token))
}

function imageFromPictures(pictures) {
  const picture = Array.isArray(pictures) ? pictures[0] : null
  if (!picture) {
    return ''
  }

  return picture.fullImagePath || picture.large || picture.rotator || picture.medium || picture.small || picture.thumbnail || picture.url || picture.uri || ''
}

function imageFromStructuredData(data) {
  const items = Array.isArray(data) ? data : [data]

  for (const item of items) {
    const image = item?.image

    if (typeof image === 'string') {
      return image
    }

    if (Array.isArray(image)) {
      const imageUrl = imageFromStructuredData(image.map((entry) => ({ image: entry })))
      if (imageUrl) {
        return imageUrl
      }
    }

    if (image?.url) {
      return image.url
    }

    if (image?.image) {
      return image.image
    }
  }

  return ''
}

function decodeAstroValue(value) {
  if (Array.isArray(value)) {
    const [tag, payload] = value

    if (typeof tag === 'number' && value.length === 2) {
      if (tag === 1) {
        return payload.map(decodeAstroValue)
      }

      return decodeAstroValue(payload)
    }

    return value.map(decodeAstroValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeAstroValue(item)]))
  }

  return value
}

function parseZaobaoTime(value) {
  if (!value) {
    return 0
  }

  return new Date(`${String(value).replace(' ', 'T')}+08:00`).getTime()
}

function absoluteUrl(url) {
  if (!url) {
    return ''
  }

  return new URL(decodeHtml(url), ZAOBAO_ORIGIN).toString()
}

function absoluteImageUrl(url) {
  if (!url) {
    return ''
  }

  const decoded = decodeHtml(url)
  if (decoded.startsWith('/articles/')) {
    return `${ZAOBAO_IMAGE_ORIGIN}${decoded}`
  }

  return new URL(decoded, ZAOBAO_ORIGIN).toString()
}

function isUsableImage(url) {
  return Boolean(url && !url.includes(DEFAULT_IMAGE_MARKER))
}

function readAttribute(source, name) {
  return decodeHtml(source.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] || '')
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function decodeHtml(value) {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function requestHeaders() {
  return {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/126 Safari/537.36'
    }
  }
}
