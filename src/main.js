import { CHANNELS, fetchNewsBundle, filterNews, formatRelativeTime } from './news.js'
import './styles.css'

const state = {
  allNews: [],
  sources: [],
  activeChannel: 'Recommended',
  activePublisher: '',
  feedRefreshSeed: 0,
  hiddenPublishers: JSON.parse(localStorage.getItem('hiddenPublishers') || '[]'),
  followOverrides: JSON.parse(localStorage.getItem('followOverrides') || '{}'),
  collapsedSections: JSON.parse(localStorage.getItem('collapsedSectionsV3') || '{}'),
  customizeView: 'publishers'
}

const app = document.querySelector('#app')

renderShell()
loadNews()

function renderShell() {
  app.innerHTML = `
    <section class="page-shell">
      <section class="news-board">
        <aside class="news-sidebar">
          <button class="sidebar-tab is-active" data-preset="Recommended" type="button">为您推荐</button>
          <button class="sidebar-tab" data-preset="Following" type="button">正在关注</button>

          <div class="sidebar-section">
            <div class="section-heading">
              <button class="collapse-button" data-toggle-section="channels" type="button" aria-label="收起频道">⌄</button>
              <strong data-toggle-section="channels">频道</strong>
              <button data-open-customize="channels" type="button" title="添加频道">＋</button>
            </div>
            <nav class="sidebar-list" data-section="channels" data-channels></nav>
          </div>

          <div class="publisher-groups" data-publisher-groups></div>
        </aside>

        <section class="feed-panel" aria-live="polite">
          <div class="feed-list" data-feed>
            <article class="loading-card">正在加载新闻...</article>
          </div>
        </section>
      </section>

      <div class="floating-actions">
        <button data-open-customize="publishers" type="button" title="自定义">☷</button>
        <button data-refresh type="button" title="刷新">↻</button>
      </div>

      <section class="customize-overlay" data-customize hidden>
        <div class="customize-panel" role="dialog" aria-modal="true" aria-label="自定义 Brave 新闻">
          <header class="customize-header">
            <button data-close-customize type="button" class="back-button">‹ 返回仪表板</button>
            <div class="customize-title">
              <span>Brave 新闻</span>
              <button class="news-toggle" type="button" aria-pressed="true"><span></span></button>
              <span>打开文章</span>
              <button class="article-target" type="button">打开新的标签页⌄</button>
            </div>
            <button data-close-customize type="button" class="close-button" aria-label="关闭">×</button>
          </header>

          <div class="customize-body">
            <aside class="customize-side">
              <div class="follow-summary">
                <strong>正在关注</strong>
                <span data-follow-count>0 个来源</span>
              </div>
              <nav class="customize-channel-list" data-customize-channels></nav>
              <nav class="customize-source-list" data-followed-sources></nav>
            </aside>

            <section class="customize-content">
              <h2 data-customize-heading>热门</h2>
              <div class="source-grid" data-source-grid></div>
            </section>
          </div>
        </div>
      </section>
    </section>
  `

  renderChannels()
  renderPublishers()
  renderCollapsedSections()
  bindPresetButtons()
  bindCustomizeControls()
  bindSectionToggles()
  app.querySelector('[data-refresh]').addEventListener('click', () => loadNews(true))
}

async function loadNews(forceRefresh = false) {
  setLoading(true)

  try {
    const seed = forceRefresh ? Date.now() : state.feedRefreshSeed
    const bundle = await fetchNewsBundle({ cacheBust: forceRefresh ? Date.now() : '' })
    state.feedRefreshSeed = seed
    state.sources = bundle.sources
    state.allNews = applyFollowState(bundle.news)
    renderPublishers()
    renderCustomize()
    renderFeed()
  } catch (error) {
    app.querySelector('[data-feed]').innerHTML = `
      <article class="error-card">
        <strong>新闻加载失败</strong>
        <span>${error.message}</span>
      </article>
    `
  }
}

function renderChannels() {
  app.querySelector('[data-channels]').innerHTML = CHANNELS
    .map((channel) => `
      <button class="sidebar-item ${channel === state.activeChannel ? 'is-active' : ''}" data-channel="${channel}" type="button">
        <span>${translateChannel(channel)}</span>
      </button>
    `)
    .join('')

  app.querySelectorAll('[data-channel]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeChannel = button.dataset.channel
      state.activePublisher = ''
      renderChannels()
      renderPublishers()
      renderPresetButtons()
      renderFeed()
    })
  })
}

function renderFeed() {
  const feed = getVisibleFeed().slice(0, 36)
  const feedEl = app.querySelector('[data-feed]')

  if (!feed.length) {
    feedEl.innerHTML = '<article class="empty-card">当前分类没有新闻</article>'
    return
  }

  feedEl.innerHTML = feed.map(renderArticle).join('')

  feedEl.querySelectorAll('[data-hide-publisher]').forEach((button) => {
    button.addEventListener('click', () => {
      const publisher = button.dataset.hidePublisher
      state.hiddenPublishers = [...new Set([...state.hiddenPublishers, publisher])]
      localStorage.setItem('hiddenPublishers', JSON.stringify(state.hiddenPublishers))
      renderPublishers()
      renderFeed()
    })
  })
}

function bindCustomizeControls() {
  app.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-customize]')
    if (button) {
      state.customizeView = button.dataset.openCustomize
      openCustomize()
    }
  })

  app.querySelectorAll('[data-close-customize]').forEach((button) => {
    button.addEventListener('click', closeCustomize)
  })

  app.querySelector('[data-customize]').addEventListener('click', (event) => {
    if (event.target.matches('[data-customize]')) {
      closeCustomize()
    }
  })
}

function renderArticle(item, index) {
  const isLead = index === 0
  const image = item.imageUrl
    ? `<img src="${proxyImageUrl(item.imageUrl)}" alt="" loading="${isLead ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" onerror="this.closest('.image-wrap').classList.add('has-error')" />`
    : '<div class="image-fallback"></div>'

  return `
    <article class="news-card ${isLead ? 'lead-card' : ''}">
      <a class="image-wrap" href="${item.url}" target="_blank" rel="noreferrer">${image}</a>
      <div class="card-content">
        <div class="meta-row">
          <span>${item.publisherName}</span>
          <span>${translateChannel(item.category)}</span>
          <span>${formatRelativeTime(item.publishedAt)}</span>
          ${item.isNew ? '<b>NEW</b>' : ''}
        </div>
        <h3><a href="${item.url}" target="_blank" rel="noreferrer">${item.title}</a></h3>
        <button class="menu-button" data-hide-publisher="${item.publisherName}" type="button" title="隐藏来源">•••</button>
      </div>
    </article>
  `
}

function setLoading(isLoading) {
  if (isLoading) {
    app.querySelector('[data-feed]').innerHTML = '<article class="loading-card">正在加载新闻...</article>'
  }
}

function bindPresetButtons() {
  app.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeChannel = button.dataset.preset
      state.activePublisher = ''
      renderPresetButtons()
      renderChannels()
      renderPublishers()
      renderFeed()
    })
  })
}

function renderPresetButtons() {
  app.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.preset === state.activeChannel)
  })
}

function bindSectionToggles() {
  app.addEventListener('click', (event) => {
    const button = event.target.closest('[data-toggle-section]')
    if (!button) {
      return
    }

    const section = button.dataset.toggleSection
    state.collapsedSections[section] = !isSectionCollapsed(section)
    localStorage.setItem('collapsedSectionsV3', JSON.stringify(state.collapsedSections))
    renderCollapsedSections()
  })
}

function renderCollapsedSections() {
  app.querySelectorAll('[data-toggle-section]').forEach((button) => {
    const section = button.dataset.toggleSection
    const collapsed = isSectionCollapsed(section)
    button.classList.toggle('is-collapsed', collapsed)
    button.setAttribute('aria-expanded', String(!collapsed))
  })

  app.querySelectorAll('[data-section]').forEach((sectionEl) => {
    sectionEl.hidden = isSectionCollapsed(sectionEl.dataset.section)
  })
}

function isSectionCollapsed(section) {
  if (Object.prototype.hasOwnProperty.call(state.collapsedSections, section)) {
    return Boolean(state.collapsedSections[section])
  }

  if (section === 'publisher-news') {
    return false
  }

  return section.startsWith('publisher-')
}

function renderPublishers() {
  const groups = getPublisherGroups(getSidebarPublishers())

  app.querySelector('[data-publisher-groups]').innerHTML = groups
    .map((group) => {
      const section = `publisher-${group.key}`
      return `
        <section class="sidebar-section publisher-group">
          <div class="section-heading publisher-heading">
            <button class="collapse-button" data-toggle-section="${section}" type="button" aria-label="展开${group.label}">⌄</button>
            <strong data-toggle-section="${section}">${group.label}</strong>
          </div>
          <nav class="sidebar-list publisher-list" data-section="${section}">
          ${group.publishers.map((publisher) => `
            <button class="sidebar-item publisher-item ${publisher.name === state.activePublisher ? 'is-active' : ''}" data-publisher="${escapeHtml(publisher.name)}" type="button">
              <span class="publisher-name">${escapeHtml(publisher.name)}</span>
              ${publisherTag(publisher.name, publisher.category)}
            </button>
          `).join('')}
          </nav>
        </section>
      `
    })
    .join('')

  renderCollapsedSections()

  app.querySelectorAll('[data-publisher]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activePublisher = button.dataset.publisher
      state.activeChannel = 'All'
      renderPresetButtons()
      renderChannels()
      renderPublishers()
      renderFeed()
    })
  })
}

function getPublisherGroups(publishers) {
  const assigned = new Set()
  const groups = publisherGroups().map((group) => {
    const groupPublishers = publishers
      .filter((publisher) => {
        if (assigned.has(publisher.name)) {
          return false
        }

        return hasPublisherNewsInGroup(publisher.name, group.categories)
      })
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .slice(0, 5)

    groupPublishers.forEach((publisher) => assigned.add(publisher.name))
    return { ...group, publishers: groupPublishers }
  })

  const otherPublishers = publishers
    .filter((publisher) => !assigned.has(publisher.name) && hasPublisherNews(publisher.name))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, 5)

  if (otherPublishers.length) {
    groups.push({ key: 'other', label: '其他', categories: [], publishers: otherPublishers })
  }

  return groups.filter((group) => group.publishers.length)
}

function hasPublisherNewsInGroup(publisher, categories) {
  return state.allNews.some((item) => {
    if (item.publisherName !== publisher || state.hiddenPublishers.includes(item.publisherName)) {
      return false
    }

    const labels = new Set([item.category, ...item.channels].filter(Boolean))
    return categories.some((category) => labels.has(category))
  })
}

function hasPublisherNews(publisher) {
  return state.allNews.some((item) => item.publisherName === publisher && !state.hiddenPublishers.includes(item.publisherName))
}

function getSidebarPublishers() {
  if (state.sources.length) {
    return state.sources
      .filter((source) => !state.hiddenPublishers.includes(source.name))
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .map((source) => ({
        name: source.name,
        category: source.category,
        channels: source.channels,
        rank: source.rank
      }))
  }

  return [...new Set(state.allNews.map((item) => item.publisherName))]
    .filter((publisher) => !state.hiddenPublishers.includes(publisher))
    .map((publisher) => ({
      name: publisher,
      category: dominantCategoryForPublisher(publisher),
      channels: [],
      rank: 999
    }))
}

function openCustomize() {
  renderCustomize()
  app.querySelector('[data-customize]').hidden = false
}

function closeCustomize() {
  app.querySelector('[data-customize]').hidden = true
}

function renderCustomize() {
  renderCustomizeChannels()
  renderFollowedSources()
  renderSourceGrid()
  bindSourceToggles()
}

function renderCustomizeChannels() {
  const followedCount = state.sources.filter(isSourceFollowed).length
  app.querySelector('[data-follow-count]').textContent = `${followedCount} 个来源`
  app.querySelector('[data-customize-channels]').innerHTML = CHANNELS
    .map((channel) => `
      <button class="customize-channel ${state.customizeView === channel ? 'is-active' : ''}" data-customize-channel="${channel}" type="button">
        <span class="channel-icon">${channelIcon(channel)}</span>
        <span>${translateChannel(channel)}</span>
      </button>
    `)
    .join('')

  app.querySelectorAll('[data-customize-channel]').forEach((button) => {
    button.addEventListener('click', () => {
      state.customizeView = button.dataset.customizeChannel
      renderCustomize()
    })
  })
}

function renderFollowedSources() {
  app.querySelector('[data-followed-sources]').innerHTML = state.sources
    .filter(isSourceFollowed)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, 12)
    .map((source) => `
      <button class="followed-source" data-toggle-source="${source.id}" type="button">
        <img src="${proxyImageUrl(source.faviconUrl)}" alt="" loading="lazy" />
        <span>${escapeHtml(source.name)}</span>
      </button>
    `)
    .join('')

}

function renderSourceGrid() {
  const visibleSources = getCustomizeSources().slice(0, 36)
  const isChannelView = CHANNELS.includes(state.customizeView)
  app.querySelector('[data-customize-heading]').textContent = isChannelView ? translateChannel(state.customizeView) : '热门'
  app.querySelector('[data-source-grid]').innerHTML = visibleSources
    .map((source) => `
      <article class="source-card ${isSourceFollowed(source) ? 'is-followed' : ''}">
        <button class="source-cover" data-toggle-source="${source.id}" type="button" style="--source-bg: ${source.backgroundColor}">
          <img src="${proxyImageUrl(source.coverUrl || source.faviconUrl)}" alt="" loading="lazy" onerror="this.closest('.source-cover').classList.add('has-error')" />
          <strong class="source-initials">${sourceInitial(source.name)}</strong>
          <span>${isSourceFollowed(source) ? '✓' : '+'}</span>
        </button>
        <h3>${escapeHtml(source.name)}</h3>
      </article>
    `)
    .join('')

}

function getCustomizeSources() {
  if (CHANNELS.includes(state.customizeView)) {
    return state.sources
      .filter((source) => source.category === state.customizeView || source.channels.includes(state.customizeView))
      .sort((a, b) => a.rank - b.rank || b.score - a.score)
  }

  return [...state.sources].sort((a, b) => {
    if (isSourceFollowed(a) !== isSourceFollowed(b)) {
      return isSourceFollowed(a) ? -1 : 1
    }

    return a.rank - b.rank || b.score - a.score
  })
}

function bindSourceToggles() {
  app.querySelectorAll('[data-toggle-source]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleSource(button.dataset.toggleSource)
    })
  })
}

function toggleSource(sourceId) {
  const source = state.sources.find((item) => item.id === sourceId)
  if (!source) {
    return
  }

  state.followOverrides[sourceId] = !isSourceFollowed(source)
  localStorage.setItem('followOverrides', JSON.stringify(state.followOverrides))
  state.allNews = applyFollowState(state.allNews)
  renderPublishers()
  renderCustomize()
  renderFeed()
}

function getVisibleFeed() {
  let filtered = filterNews(state.allNews, state.activeChannel, state.hiddenPublishers)

  // 关注来源来自 Brave 的源列表；若当天 feed 未命中，则回退到推荐流避免空列表。
  if (state.activeChannel === 'Following' && !filtered.length) {
    filtered = filterNews(state.allNews, 'Recommended', state.hiddenPublishers)
  }

  if (!state.activePublisher) {
    return sortFeedForPreset(filtered)
  }

  return sortFeedForPreset(filtered.filter((item) => item.publisherName === state.activePublisher))
}

function applyFollowState(news) {
  return news.map((item) => {
    const source = state.sources.find((sourceItem) => sourceItem.id === item.publisherId)
    return {
      ...item,
      isFollowed: source ? isSourceFollowed(source) : item.isFollowed
    }
  })
}

function isSourceFollowed(source) {
  return state.followOverrides[source.id] ?? source.enabled
}

function sortFeedForPreset(feed) {
  if (state.activeChannel !== 'Recommended') {
    return feed
  }

  if (state.feedRefreshSeed) {
    return rankFeedBySeed(feed, state.feedRefreshSeed)
  }

  return [...feed].sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt)
}

function rankFeedBySeed(feed, seed) {
  return [...feed].sort((a, b) => {
    const aRank = seededRank(a.id, seed)
    const bRank = seededRank(b.id, seed)
    return bRank - aRank || b.publishedAt - a.publishedAt
  })
}

function seededRank(value, seed) {
  const text = `${value}:${seed}`
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function proxyImageUrl(url) {
  if (!url) {
    return ''
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname)

  if (isLocal) {
    return url
  }

  return `/api/image?url=${encodeURIComponent(url)}`
}

function translateChannel(channel) {
  const labels = {
    All: '全部新闻',
    Recommended: '为您推荐',
    Following: '正在关注',
    Brave: 'Brave 官方',
    'Top News': '头条新闻',
    'Top Sources': '最大来源',
    Technology: '科技',
    Business: '商业',
    Culture: '文化',
    Gaming: '游戏',
    Home: '首页',
    Science: '科学',
    Sports: '体育',
    'Tech News': '科技',
    Games: '游戏',
    News: '新闻'
  }

  return labels[channel] || channel
}

function channelIcon(channel) {
  const icons = {
    Brave: '🦁',
    Business: '▦',
    Gaming: '♟',
    Home: '⌂',
    Science: '⚗',
    'Top News': '♕',
    'Top Sources': '▤'
  }

  return icons[channel] || '•'
}

function sourceInitial(name) {
  return escapeHtml((name || '?').trim().slice(0, 1).toUpperCase())
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function dominantCategoryForPublisher(publisher) {
  const categories = state.allNews
    .filter((item) => item.publisherName === publisher)
    .reduce((counts, item) => {
      counts.set(item.category, (counts.get(item.category) || 0) + 1)
      return counts
    }, new Map())

  return [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'News'
}

function publisherTag(name, category) {
  const tag = PUBLISHER_TAGS[name] || PUBLISHER_TAGS[name.toLowerCase()]
  return `<span class="publisher-tag">${escapeHtml(tag || fallbackPublisherTag(category))}</span>`
}

function fallbackPublisherTag(category) {
  const tags = {
    Brave: 'Brave / 官方',
    Business: '商业 / 财经',
    Culture: '文化 / 生活',
    Entertainment: '娱乐 / 影视',
    Gaming: '游戏 / 娱乐',
    Health: '健康 / 科普',
    Home: '生活 / 家居',
    Movies: '影视 / 评论',
    Science: '科学 / 科普',
    Sports: '体育 / 新闻',
    Technology: '科技 / 新闻',
    'Tech News': '科技 / 新闻',
    'Tech Reviews': '科技 / 评测',
    'Top News': '综合 / 头条',
    'Top Sources': '综合 / 来源',
    'US News': '美国 / 新闻',
    'World News': '世界 / 新闻',
    Crypto: '行业 / 加密',
    Fashion: '时尚 / 文化',
    Food: '生活 / 美食',
    Politics: '政治 / 新闻',
    Travel: '生活 / 旅行'
  }

  return tags[category] || `${translateChannel(category)} / 新闻`
}

// 已知发布者用更具体的定位；其他发布者按当前新闻分类自动兜底。
const PUBLISHER_TAGS = {
  'WSJ Arts & Culture': '中右 / 商业精英',
  'Al Jazeera': '中东 / 国际',
  'CBS News': '主流 / 综合',
  'CNBC US News': '商业 / 财经',
  CoinDesk: '行业 / 加密',
  ESPN: '体育 / ESPN',
  'FOX News': '右 / 保守派',
  Insider: '中左 / 大众商业',
  Parade: '文化 / 娱乐',
  RawStory: '左 / 政治',
  'The Athletic': '体育 / 深度',
  'The Motley Fool': '投资 / 个人理财',
  Sportskeeda: '体育 / 娱乐',
  TechRadar: '科技 / 评测',
  Vogue: '中左 / 时尚文化',
  Sportingnews: '体育 / 新闻',
  'Sporting News': '体育 / 新闻',
  'South China Morning Post': '中间 / 香港视角',
  Healthline: '健康 / 科普',
  'The Mirror': '左 / 英国大众报',
  CBSSports: '体育 / CBS',
  'CBS Sports': '体育 / CBS',
  'BuzzFeed Health': '中左 / 健康生活',
  'The New York Times': '中左 / 主流综合'
}

function publisherGroups() {
  return [
    {
      key: 'news',
      label: '新闻',
      categories: ['Top News', 'World News', 'US News', 'News', 'Politics']
    },
    {
      key: 'business',
      label: '商业',
      categories: ['Business', 'Crypto']
    },
    {
      key: 'technology',
      label: '科技',
      categories: ['Technology', 'Tech News', 'Tech Reviews']
    },
    {
      key: 'sports',
      label: '体育',
      categories: ['Sports']
    },
    {
      key: 'gaming',
      label: '游戏',
      categories: ['Gaming', 'Games']
    },
    {
      key: 'culture',
      label: '文化',
      categories: ['Culture', 'Entertainment', 'Fashion', 'Movies']
    },
    {
      key: 'health',
      label: '健康',
      categories: ['Health', 'Science']
    },
    {
      key: 'lifestyle',
      label: '生活',
      categories: ['Home', 'Food', 'Travel']
    }
  ]
}
