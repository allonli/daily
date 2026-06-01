import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildZaobaoSectionItems,
  collectZaobaoNews,
  completeZaobaoImages,
  extractArticleImage,
  fetchZaobaoNews,
  getCachedZaobaoNews,
  parseZaobaoHome,
  parseZaobaoRealtimePage
} from '../src/zaobao.js'

function attr(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

function encoded(value) {
  if (Array.isArray(value)) {
    return [1, value.map(encoded)]
  }

  if (value && typeof value === 'object') {
    return [0, Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encoded(item)]))]
  }

  return [0, value]
}

function item(index, overrides = {}) {
  return {
    id: index,
    title: `最新新闻 ${index}`,
    url: `/news/china/story20260530-${index}`,
    publicationDate: '2026-05-30 18:12:00',
    mainSitemapName: '中国',
    serverTime: `${index}分钟前`,
    pictures: [],
    ...overrides
  }
}

test('parseZaobaoHome 提取首页头图和右侧第一组最新最多15条', () => {
  const latest = Array.from({ length: 16 }, (_, index) => item(index + 1))
  latest[0].pictures = [{ large: 'https://cdn.example.com/latest-1.jpg' }]
  const props = attr(JSON.stringify({ initialData: encoded([{ data: latest }, { data: [item(99)] }]) }))
  const html = `
    <a href="/news/world/story20260530-9129429?ref=home-top-news" data-testid="rotator">
      <img src="https://cdn.example.com/lead.jpg" alt="头图说明">
      <div title="头图新闻">头图新闻</div>
    </a>
    <astro-island component-url="RealTimeGroupList.js" props="${props}"></astro-island>
  `

  const result = parseZaobaoHome(html)

  assert.equal(result.lead.title, '头图新闻')
  assert.equal(result.lead.url, 'https://www.zaobao.com/news/world/story20260530-9129429?ref=home-top-news')
  assert.equal(result.lead.imageUrl, 'https://cdn.example.com/lead.jpg')
  assert.equal(result.latest.length, 15)
  assert.equal(result.latest[0].title, '最新新闻 1')
  assert.equal(result.latest[0].imageUrl, 'https://cdn.example.com/latest-1.jpg')
  assert.equal(result.latest[14].url, 'https://www.zaobao.com/news/china/story20260530-15')
})

test('parseZaobaoHome 优先解析头图容器和右侧最新容器', () => {
  const decoyProps = attr(JSON.stringify({ initialData: encoded([{ data: [item(99, { title: '错误最新' })] }]) }))
  const latest = Array.from({ length: 2 }, (_, index) => item(index + 1, { title: `右侧最新 ${index + 1}` }))
  const asideProps = attr(JSON.stringify({ initialData: encoded([{ data: latest }]) }))
  const html = `
    <a href="/news/world/story20260530-wrong" data-testid="rotator">
      <img src="https://cdn.example.com/wrong.jpg">
      <div title="错误头图">错误头图</div>
    </a>
    <astro-island component-url="RealTimeGroupList.js" props="${decoyProps}"></astro-island>
    <div class="relative foo lg:order-2 order-1">
      <a href="/news/world/story20260530-9129429?ref=home-top-news" class="relative" data-testid="rotator">
        <img src="https://cdn.example.com/lead.jpg" alt="头图说明">
        <div title="正确头图">正确头图</div>
      </a>
    </div>
    <div class="pt-4 order-130 relative w-full" data-testid="aside-realtime">
      <astro-island component-url="RealTimeGroupList.js" props="${asideProps}"></astro-island>
    </div>
  `

  const result = parseZaobaoHome(html)

  assert.equal(result.lead.title, '正确头图')
  assert.equal(result.lead.imageUrl, 'https://cdn.example.com/lead.jpg')
  assert.equal(result.latest.length, 2)
  assert.equal(result.latest[0].title, '右侧最新 1')
})

test('parseZaobaoRealtimePage 解析静态最新列表', () => {
  const html = `
    <a class="py-4" href="/news/china/story20260530-9131106">
      <span class="text-red-500 font-medium"> 18:12 </span>
      <article class="flex-1 text-lg line-clamp-1"> 港首产载荷专家 陈国基称香港已成中国航天事业参与者 </article>
    </a>
    <a class="py-4" href="/news/world/story20260530-9131184">
      <span class="text-red-500 font-medium"> 29分钟前 </span>
      <article class="flex-1 text-lg line-clamp-1"> 缅甸总统抵达印度访问 加强双边关系 </article>
    </a>
  `

  const result = parseZaobaoRealtimePage(html)

  assert.equal(result.length, 2)
  assert.equal(result[0].title, '港首产载荷专家 陈国基称香港已成中国航天事业参与者')
  assert.equal(result[0].timeLabel, '18:12')
  assert.equal(result[0].category, '中国')
  assert.equal(result[0].url, 'https://www.zaobao.com/news/china/story20260530-9131106')
  assert.equal(result[1].category, '国际')
})

test('completeZaobaoImages 为缺图新闻预取详情页主图', async () => {
  const requests = []
  const items = [
    { title: '已有图片', url: 'https://www.zaobao.com/a', imageUrl: 'https://cdn.example.com/a.jpg' },
    { title: '缺图新闻', url: 'https://www.zaobao.com/b', imageUrl: '' }
  ]

  const result = await completeZaobaoImages(items, async (url) => {
    requests.push(url)
    return {
      ok: true,
      text: async () => '<script type="application/ld+json">{"image":{"url":"https://cdn.example.com/b.jpg"}}</script>'
    }
  })

  assert.deepEqual(requests, ['https://www.zaobao.com/b'])
  assert.equal(result[0].imageUrl, 'https://cdn.example.com/a.jpg')
  assert.equal(result[1].imageUrl, 'https://cdn.example.com/b.jpg')
})

test('extractArticleImage 忽略默认占位图并读取结构化主图', () => {
  const html = `
    <meta property="og:image" content="https://dss0.zbstatic5.com/web2/_astro/pic-default.B3kZzJ_A.png">
    <script type="application/ld+json">{"image":{"url":"https://cdn.example.com/article.jpg"}}</script>
  `

  assert.equal(extractArticleImage(html), 'https://cdn.example.com/article.jpg')
})

test('buildZaobaoSectionItems 用头图加最多15条最新新闻', () => {
  const result = buildZaobaoSectionItems({
    lead: { title: '头图', url: 'https://www.zaobao.com/lead' },
    latest: Array.from({ length: 16 }, (_, index) => ({ title: `新闻 ${index}`, url: `https://www.zaobao.com/${index}` }))
  })

  assert.equal(result.length, 16)
  assert.equal(result[0].title, '头图')
  assert.equal(result[15].title, '新闻 14')
})

test('buildZaobaoSectionItems 忽略空缓存', () => {
  assert.deepEqual(buildZaobaoSectionItems(null), [])
})

test('fetchZaobaoNews 请求失败时返回浏览器缓存', async () => {
  const cached = { lead: { title: '缓存头图', url: 'https://www.zaobao.com/cached' }, latest: [] }
  const storage = new Map([['zaobaoNewsCacheV1', JSON.stringify({ savedAt: Date.now(), data: cached })]])

  const result = await fetchZaobaoNews({
    fetchImpl: async () => ({ ok: false, status: 502 }),
    storage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  })

  assert.equal(result.lead.title, '缓存头图')
})

test('fetchZaobaoNews 默认请求稳定缓存键', async () => {
  const requests = []
  await fetchZaobaoNews({
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        json: async () => ({ lead: { title: '最新头图', url: 'https://www.zaobao.com/latest' }, latest: [] })
      }
    },
    storage: null
  })

  assert.deepEqual(requests, [{ url: '/api/zaobao', options: {} }])
})

test('fetchZaobaoNews 强刷时才请求 refresh 缓存键', async () => {
  const requests = []
  await fetchZaobaoNews({
    refresh: true,
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        json: async () => ({ lead: { title: '强刷头图', url: 'https://www.zaobao.com/refresh' }, latest: [] })
      }
    },
    storage: null
  })

  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /^\/api\/zaobao\?refresh=1&t=\d+$/)
  assert.deepEqual(requests[0].options, { cache: 'no-store' })
})

test('getCachedZaobaoNews 可在网络请求前读取本地旧缓存', () => {
  const cached = { lead: { title: '本地头图', url: 'https://www.zaobao.com/local' }, latest: [] }
  const storage = new Map([['zaobaoNewsCacheV1', JSON.stringify({ savedAt: Date.now(), data: cached })]])

  const result = getCachedZaobaoNews({
    getItem: (key) => storage.get(key) || null
  })

  assert.equal(result.lead.title, '本地头图')
})

test('collectZaobaoNews 上游失败时返回传入的上一版数据', async () => {
  const fallback = { lead: { title: '上一版头图', url: 'https://www.zaobao.com/stale' }, latest: [] }

  const result = await collectZaobaoNews({
    fallback,
    fetchImpl: async () => ({ ok: false, status: 503 })
  })

  assert.equal(result.lead.title, '上一版头图')
})

test('collectZaobaoNews 首页无最新数据时回退到静态最新页并补图', async () => {
  const requests = []
  const responses = new Map([
    ['https://www.zaobao.com/cn', '<html></html>'],
    ['https://www.zaobao.com/realtime', `
      <a href="/news/china/story20260530-9131106">
        <span class="text-red-500 font-medium">18:12</span>
        <article>港首产载荷专家 陈国基称香港已成中国航天事业参与者</article>
      </a>
      <a href="/news/world/story20260530-9131184">
        <span class="text-red-500 font-medium">29分钟前</span>
        <article>缅甸总统抵达印度访问 加强双边关系</article>
      </a>
    `],
    ['https://www.zaobao.com/news/china/story20260530-9131106', '<script type="application/ld+json">{"image":"https://cdn.example.com/lead.jpg"}</script>'],
    ['https://www.zaobao.com/news/world/story20260530-9131184', '<script type="application/ld+json">{"image":"https://cdn.example.com/world.jpg"}</script>']
  ])

  const result = await collectZaobaoNews({
    fetchImpl: async (url) => {
      requests.push(url)
      return {
        ok: responses.has(url),
        status: responses.has(url) ? 200 : 404,
        text: async () => responses.get(url)
      }
    }
  })

  assert.deepEqual(requests, [
    'https://www.zaobao.com/cn',
    'https://www.zaobao.com/realtime',
    'https://www.zaobao.com/news/china/story20260530-9131106',
    'https://www.zaobao.com/news/world/story20260530-9131184'
  ])
  assert.equal(result.lead.title, '港首产载荷专家 陈国基称香港已成中国航天事业参与者')
  assert.equal(result.lead.category, '头图')
  assert.equal(result.lead.imageUrl, 'https://cdn.example.com/lead.jpg')
  assert.equal(result.latest.length, 1)
  assert.equal(result.latest[0].imageUrl, 'https://cdn.example.com/world.jpg')
})
