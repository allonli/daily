import test from 'node:test'
import assert from 'node:assert/strict'
import { SIDEBAR_CHANNELS } from '../src/app-config.js'
import { filterNews } from '../src/news.js'
import { compactSnapshotNews, PUBLISHER_GROUPS } from '../src/snapshot-news.js'

function item(publisherName, index, category = 'Other', channels = []) {
  return { id: `${publisherName}:${index}`, publisherName, publisherId: publisherName, category, channels, isFollowed: index % 2 === 0 }
}

test('压缩保持各可见频道原首屏和第二屏顺序，不改新闻内容和关注字段', () => {
  const news = Array.from({ length: 120 }, (_, index) => SIDEBAR_CHANNELS.map((channel) => item(`${channel}:${index}`, index, channel))).flat()
  const compact = compactSnapshotNews(news, [])

  for (const channel of SIDEBAR_CHANNELS) {
    assert.deepEqual(filterNews(compact, channel).slice(0, 36), filterNews(news, channel).slice(0, 36))
    assert.deepEqual(filterNews(compact, channel).slice(0, 72), filterNews(news, channel).slice(0, 72))
  }
  assert.equal(compact.length, SIDEBAR_CHANNELS.length * 72)
  assert.ok(compact.every((entry) => news.includes(entry)))
  assert.deepEqual(compact, news.filter((entry) => compact.includes(entry)))
})

test('每组按来源 rank 选前五，包含其他组；每个可见来源仍保留原前36条', () => {
  const categories = [...PUBLISHER_GROUPS.map((group) => group.categories[0]), 'Other']
  const sources = categories.flatMap((category, groupIndex) => Array.from({ length: 6 }, (_, rank) => ({
    id: `source:${groupIndex}:${rank}`, name: `source:${groupIndex}:${rank}`, rank, enabled: rank % 2 === 0
  })))
  const news = Array.from({ length: 60 }, (_, index) => sources.map((source, sourceIndex) => item(source.name, index, categories[Math.floor(sourceIndex / 6)]))).flat()
  const before = JSON.stringify({ news, sources })
  const compact = compactSnapshotNews(news, [...sources].reverse())

  for (const source of sources.filter((source) => source.rank < 5)) {
    assert.deepEqual(compact.filter((entry) => entry.publisherName === source.name).slice(0, 36), news.filter((entry) => entry.publisherName === source.name).slice(0, 36))
  }
  assert.equal(compact.filter((entry) => entry.publisherName === 'source:8:5').length, 0)
  assert.ok(compact.length < news.length * 0.7)
  assert.equal(JSON.stringify({ news, sources }), before)
})

test('跨分类来源只分组一次，并保留首屏后的分组依据', () => {
  const sources = [
    { name: '多分类来源', rank: 1 },
    { name: '后置科学来源', rank: 2 }
  ]
  const news = Array.from({ length: 100 }, (_, index) => item('多分类来源', index, 'Top News', ['Business']))
    .concat(Array.from({ length: 40 }, (_, index) => item('后置科学来源', index, index === 39 ? 'Health' : 'Other')))
  const compact = compactSnapshotNews(news, sources)

  assert.deepEqual(compact.filter((entry) => entry.publisherName === '多分类来源').slice(0, 36), news.filter((entry) => entry.publisherName === '多分类来源').slice(0, 36))
  assert.equal(compact.filter((entry) => entry.publisherName === '后置科学来源').length, 37)
  assert.ok(compact.includes(news.at(-1)))
  assert.equal(new Set(compact).size, compact.length)
})

test('相同 rank 用名称排序，只保留有新闻的来源，空输入仍为空', () => {
  const sources = ['F', 'E', 'D', 'C', 'B', 'A', '无新闻'].map((name) => ({ name, rank: 1 }))
  const news = ['F', 'E', 'D', 'C', 'B', 'A'].map((name) => item(name, 0))

  assert.deepEqual(compactSnapshotNews(news, sources).map((entry) => entry.publisherName), ['E', 'D', 'C', 'B', 'A'])
  assert.deepEqual(compactSnapshotNews([], sources), [])
})
