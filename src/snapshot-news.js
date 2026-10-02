import { SIDEBAR_CHANNELS } from './app-config.js'
import { filterNews } from './news.js'

export const PUBLISHER_GROUPS = [
  { key: 'news', label: '新闻', categories: ['Top News', 'World News', 'US News', 'News', 'Politics'] },
  { key: 'business', label: '商业', categories: ['Business', 'Crypto'] },
  { key: 'technology', label: '科技', categories: ['Technology', 'Tech News', 'Tech Reviews'] },
  { key: 'sports', label: '体育', categories: ['Sports'] },
  { key: 'gaming', label: '游戏', categories: ['Gaming', 'Games'] },
  { key: 'culture', label: '文化', categories: ['Culture', 'Entertainment', 'Fashion', 'Movies'] },
  { key: 'health', label: '健康', categories: ['Health', 'Science'] },
  { key: 'lifestyle', label: '生活', categories: ['Home', 'Food', 'Travel'] }
]

export function compactSnapshotNews(news, sources) {
  const selected = new Set()
  const byPublisher = groupNewsByPublisher(news)

  // 频道保留两屏候选，来源入口保留完整的首屏；集合最后按原始 feed 顺序输出。
  for (const channel of SIDEBAR_CHANNELS) {
    for (const item of filterNews(news, channel).slice(0, 72)) {
      selected.add(item)
    }
  }

  const assigned = new Set()
  const rankedSources = [...sources].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  for (const group of PUBLISHER_GROUPS) {
    const publishers = rankedSources.filter((source) => !assigned.has(source.name)
      && byPublisher.get(source.name)?.some((item) => matchesGroup(item, group))).slice(0, 5)

    for (const source of publishers) {
      assigned.add(source.name)
      const items = byPublisher.get(source.name)
      for (const item of items.slice(0, 36)) {
        selected.add(item)
      }
      // 分类证据可能在该来源首屏之后，保留它才能让压缩后的侧栏继续归入同一组。
      selected.add(items.find((item) => matchesGroup(item, group)))
    }
  }

  const otherPublishers = rankedSources.filter((source) => !assigned.has(source.name) && byPublisher.has(source.name)).slice(0, 5)
  for (const source of otherPublishers) {
    for (const item of byPublisher.get(source.name).slice(0, 36)) {
      selected.add(item)
    }
  }

  return news.filter((item) => selected.has(item))
}

function groupNewsByPublisher(news) {
  const byPublisher = new Map()
  for (const item of news) {
    if (!byPublisher.has(item.publisherName)) {
      byPublisher.set(item.publisherName, [])
    }
    byPublisher.get(item.publisherName).push(item)
  }
  return byPublisher
}

function matchesGroup(item, group) {
  const labels = [item.category, ...(item.channels || [])]
  return group.categories.some((category) => labels.includes(category))
}
