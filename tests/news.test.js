import test from 'node:test'
import assert from 'node:assert/strict'
import { filterNews, formatRelativeTime, normalizeNews, normalizeSources, fetchNewsBundle } from '../src/news.js'

test('normalizeNews 合并新闻源信息并保留原始顺序', () => {
  const feed = [
    {
      title: '低分新闻',
      url: 'https://example.com/low',
      publisher_id: 'pub-1',
      publish_time: '2026-05-29 01:00:00',
      score: 1,
      channels: ['Technology']
    },
    {
      title: '高分新闻',
      url: 'https://example.com/high',
      publisher_id: 'pub-2',
      publish_time: '2026-05-29 02:00:00',
      score: 5,
      category: 'Top News'
    }
  ]

  const sources = [
    { publisher_id: 'pub-1', publisher_name: 'Source One', favicon_url: 'https://example.com/one.png.pad', enabled: true },
    { publisher_id: 'pub-2', publisher_name: 'Source Two', enabled: false }
  ]

  const result = normalizeNews(feed, sources)

  assert.equal(result[0].title, '低分新闻')
  assert.equal(result[0].publisherName, 'Source One')
  assert.equal(result[0].faviconUrl, 'https://example.com/one.png.pad')
  assert.equal(result[0].isFollowed, true)
  assert.equal(result[1].isFollowed, false)
})

test('filterNews 支持分类和隐藏来源', () => {
  const items = [
    { category: 'Top News', channels: ['Top News'], publisherName: 'A', isFollowed: true },
    { category: 'Gaming', channels: ['Games'], publisherName: 'B', isFollowed: false }
  ]

  assert.equal(filterNews(items, 'Top News').length, 1)
  assert.equal(filterNews(items, 'Gaming').length, 1)
  assert.equal(filterNews(items, 'Following').length, 1)
  assert.equal(filterNews(items, 'Following')[0].publisherName, 'A')
  assert.equal(filterNews(items, 'All', ['A']).length, 1)
  assert.equal(filterNews(items, 'All', ['A'])[0].publisherName, 'B')
})

test('normalizeSources 提取发布者弹层需要的字段', () => {
  const result = normalizeSources([
    {
      publisher_id: 'pub-1',
      publisher_name: 'Example News',
      category: 'Business',
      enabled: true,
      cover_url: 'https://example.com/cover.png.pad',
      favicon_url: 'https://example.com/favicon.png.pad',
      background_color: '#ffffff',
      score: 10,
      locales: [{ locale: 'en_US', channels: ['Business'], rank: 2 }]
    },
    {
      publisher_id: 'pub-2',
      publisher_name: 'Other Locale',
      locales: [{ locale: 'ja_JP', channels: ['Technology'], rank: 1 }]
    }
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'Example News')
  assert.equal(result[0].enabled, true)
  assert.equal(result[0].rank, 2)
  assert.equal(result[0].channels[0], 'Business')
})

test('fetchNewsBundle 刷新时追加缓存参数', async () => {
  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    requests.push(url)
    return {
      ok: true,
      json: async () => []
    }
  }

  try {
    await fetchNewsBundle({ cacheBust: 123 })
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requests.length, 2)
  assert.ok(requests.every((url) => url.includes('?t=123')))
})

test('formatRelativeTime 输出中文相对时间', () => {
  const now = new Date('2026-05-29T03:00:00Z')

  assert.equal(formatRelativeTime(new Date('2026-05-29T02:45:00Z'), now), '15分钟前')
  assert.equal(formatRelativeTime(new Date('2026-05-29T01:00:00Z'), now), '2小时前')
})
