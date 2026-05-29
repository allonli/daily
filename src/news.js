const FEED_URL = 'https://brave-today-cdn.brave.com/brave-today/feed.en_USjson'
const SOURCES_URL = 'https://brave-today-cdn.brave.com/sources.global.json'

export const CHANNELS = ['Brave', 'Business', 'Gaming', 'Home', 'Science', 'Top News', 'Top Sources']

export async function fetchNewsBundle(options = {}) {
  const cacheKey = options.cacheBust ? `?t=${encodeURIComponent(options.cacheBust)}` : ''
  const requestOptions = options.cacheBust ? { cache: 'no-store' } : {}
  const [feedResponse, sourcesResponse] = await Promise.all([
    fetch(`${FEED_URL}${cacheKey}`, requestOptions),
    fetch(`${SOURCES_URL}${cacheKey}`, requestOptions)
  ])

  if (!feedResponse.ok) {
    throw new Error(`新闻列表请求失败：${feedResponse.status}`)
  }

  if (!sourcesResponse.ok) {
    throw new Error(`新闻源请求失败：${sourcesResponse.status}`)
  }

  const [feed, sources] = await Promise.all([
    feedResponse.json(),
    sourcesResponse.json()
  ])

  return {
    news: normalizeNews(feed, sources),
    sources: normalizeSources(sources)
  }
}

export async function fetchNewsData() {
  return (await fetchNewsBundle()).news
}

export function normalizeNews(feed, sources) {
  const publisherMap = new Map(
    sources
      .filter((source) => source && source.publisher_id)
      .map((source) => [source.publisher_id, source])
  )

  return feed
    .filter((item) => item && item.title && item.url)
    .map((item) => {
      const publisher = publisherMap.get(item.publisher_id)
      const imageUrl = cleanImageUrl(item.padded_img || item.img || publisher?.cover_url || '')

      return {
        id: item.url_hash || item.url,
        publisherId: item.publisher_id,
        title: item.title,
        url: item.url,
        imageUrl,
        category: item.category || item.channels?.[0] || 'News',
        channels: Array.isArray(item.channels) ? item.channels : [],
        publisherName: item.publisher_name || publisher?.publisher_name || 'Unknown',
        faviconUrl: cleanImageUrl(publisher?.favicon_url || ''),
        publishedAt: parsePublishTime(item.publish_time),
        score: Number(item.score || item.pop_score || 0),
        isNew: Boolean(item.new),
        isFollowed: Boolean(publisher?.enabled)
      }
    })
}

export function normalizeSources(sources) {
  return sources
    // Brave 的 sources.global.json 是全球来源池；当前 en_US feed 只展示 en_US 来源。
    .filter((source) => source && source.publisher_id && source.publisher_name && source.locales?.some((item) => item.locale === 'en_US'))
    .map((source) => {
      const locale = source.locales.find((item) => item.locale === 'en_US')

      return {
        id: source.publisher_id,
        name: source.publisher_name,
        category: source.category || locale.channels?.[0] || 'News',
        channels: locale.channels || [],
        enabled: Boolean(source.enabled),
        coverUrl: cleanImageUrl(source.cover_url || ''),
        faviconUrl: cleanImageUrl(source.favicon_url || ''),
        backgroundColor: source.background_color || '#2d2d30',
        rank: Number(locale.rank || 999),
        score: Number(source.score || 0)
      }
    })
}

export function filterNews(items, activeChannel, hiddenPublishers = []) {
  const hidden = new Set(hiddenPublishers)
  return items.filter((item) => {
    if (hidden.has(item.publisherName)) {
      return false
    }

    if (activeChannel === 'Following') {
      return item.isFollowed
    }

    if (['All', 'Recommended'].includes(activeChannel)) {
      return true
    }

    const labels = new Set([item.category, ...item.channels].filter(Boolean))
    const aliases = CHANNEL_ALIASES[activeChannel] || [activeChannel]

    return aliases.some((alias) => labels.has(alias))
  })
}

export function formatRelativeTime(date, now = new Date()) {
  const timestamp = date instanceof Date ? date.getTime() : Number(date)
  const diffMinutes = Math.max(0, Math.round((now.getTime() - timestamp) / 60000))

  if (diffMinutes < 1) {
    return '刚刚'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}小时前`
  }

  return `${Math.round(diffHours / 24)}天前`
}

function parsePublishTime(value) {
  if (!value) {
    return 0
  }

  // Brave feed 使用空格分隔时间；补成 ISO 形态以便 Safari/Brave 稳定解析。
  return new Date(`${value.replace(' ', 'T')}Z`).getTime()
}

function cleanImageUrl(url) {
  return typeof url === 'string' ? url : ''
}

const CHANNEL_ALIASES = {
  Brave: ['Brave'],
  Business: ['Business'],
  Gaming: ['Gaming', 'Games'],
  Home: ['Home'],
  Science: ['Science'],
  'Top News': ['Top News'],
  'Top Sources': ['Top Sources']
}
