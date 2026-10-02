import { DEFAULT_CHANNEL, PRESET_CHANNELS, SIDEBAR_CHANNELS } from './app-config.js'
import { formatRelativeTime } from './news.js'
import { buildZaobaoSectionItems } from './zaobao.js'

// 构建时和浏览器共用同一份标记，首个响应就包含可阅读的新闻。
export function renderShellMarkup({ feedHtml = '', generatedAt = 0 } = {}) {
  return `
    <section class="page-shell">
      <section class="news-board">
        <aside class="news-sidebar">
          ${PRESET_CHANNELS.map((channel) => `
            <button class="sidebar-tab ${channel.id === DEFAULT_CHANNEL ? 'is-active' : ''}" data-preset="${escapeHtml(channel.id)}" type="button">${escapeHtml(channel.label)}</button>
          `).join('')}

          <div class="sidebar-section">
            <div class="section-heading">
              <button class="collapse-button" data-toggle-section="channels" type="button" aria-label="收起频道">⌄</button>
              <strong data-toggle-section="channels">频道</strong>
              <button data-open-customize="channels" type="button" title="添加频道">＋</button>
            </div>
            <nav class="sidebar-list" data-section="channels" data-channels>
              ${SIDEBAR_CHANNELS.map((channel) => `
                <button class="sidebar-item ${channel === DEFAULT_CHANNEL ? 'is-active' : ''}" data-channel="${escapeHtml(channel)}" type="button">
                  <span>${escapeHtml(translateChannel(channel))}</span>
                </button>
              `).join('')}
            </nav>
          </div>

          <div class="publisher-groups" data-publisher-groups></div>
        </aside>

        <section class="feed-panel" aria-live="polite">
          <div class="feed-list" data-feed>
            ${feedHtml || '<article class="empty-card">当前分类没有新闻</article>'}
          </div>
        </section>
      </section>

      <div class="floating-actions">
        <span class="snapshot-status" data-snapshot-status>${escapeHtml(formatSnapshotStatus(generatedAt))}</span>
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
}

export function renderArticle(item = {}, index = 0, { production = false, now = new Date() } = {}) {
  const isLead = index === 0
  const articleUrl = safeRemoteUrl(item.url)
  const linkAttributes = articleUrl ? `href="${escapeHtml(articleUrl)}"` : 'aria-disabled="true"'
  const publishedAt = Number(item.publishedAt)
  const publishedLabel = item.timeLabel || (Number.isFinite(publishedAt) && publishedAt > 0 ? formatRelativeTime(publishedAt, now) : '')
  const inlineImage = typeof item.inlineImage === 'string'
    && /^data:image\/(?:jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(item.inlineImage)
    ? item.inlineImage : ''
  const imageUrl = inlineImage || proxyImageUrl(item.imageUrl, { production })
  const originalImageUrl = getOriginalImageUrl(item.imageUrl)
  const image = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" data-original-src="${escapeHtml(originalImageUrl)}" alt="" loading="${isLead ? 'eager' : 'lazy'}"${isLead ? ' fetchpriority="high"' : ''} decoding="async" referrerpolicy="no-referrer" />`
    : '<div class="image-fallback"></div>'

  return `
    <article class="news-card ${isLead ? 'lead-card' : ''}">
      <a class="image-wrap" ${linkAttributes} target="_blank" rel="noreferrer">${image}</a>
      <div class="card-content">
        <div class="meta-row">
          <span>${escapeHtml(item.publisherName || '')}</span>
          <span>${escapeHtml(translateChannel(item.category || 'News'))}</span>
          ${publishedLabel ? `<span>${escapeHtml(publishedLabel)}</span>` : ''}
          ${item.isNew ? '<b>NEW</b>' : ''}
        </div>
        <h3><a ${linkAttributes} target="_blank" rel="noreferrer">${escapeHtml(item.title || '')}</a></h3>
        <button class="menu-button" data-hide-publisher="${escapeHtml(item.publisherName || '')}" type="button" title="隐藏来源">•••</button>
      </div>
    </article>
  `
}

export function renderZaobaoSection(bundle, { production = false, generatedAt = 0, now = new Date(), hiddenPublishers = [] } = {}) {
  const items = buildZaobaoSectionItems(bundle)
    .filter((item) => !hiddenPublishers.includes(item.publisherName))

  if (!items.length) {
    return ''
  }

  return `
    <section class="feed-section zaobao-section"${generatedAt ? ` data-generated-at="${escapeHtml(generatedAt)}"` : ''}>
      <div class="feed-section-heading">
        <h2>联合早报</h2>
        <span>最新</span>
      </div>
      <div class="feed-section-list">
        ${items.map((item, index) => renderArticle(item, index, { production, now })).join('')}
      </div>
    </section>
  `
}

export function proxyImageUrl(value, { production = false } = {}) {
  const url = getOriginalImageUrl(value)
  if (!url) {
    return ''
  }

  const imageUrl = new URL(url)
  const needsProxy = imageUrl.hostname === 'pcdn.brave.com' && imageUrl.pathname.endsWith('.pad')
  if (production && (needsProxy || String(value).startsWith('/api/image?'))) {
    return `/api/image?url=${encodeURIComponent(url)}`
  }

  return url
}

function getOriginalImageUrl(value) {
  if (typeof value === 'string' && value.startsWith('/api/image?')) {
    try {
      const proxy = new URL(value, 'https://snapshot.invalid')
      return safeRemoteUrl(proxy.searchParams.get('url'))
    } catch {
      return ''
    }
  }

  return safeRemoteUrl(value)
}

// 远程内容可以提供文字，不能提供可执行协议或任意本站路径。
export function safeRemoteUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) {
    return ''
  }

  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export function formatSnapshotStatus(generatedAt) {
  if (!generatedAt) {
    return ''
  }

  const date = new Date(generatedAt)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const label = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(date)
  return `更新于 ${label}`
}

export function translateChannel(channel) {
  const labels = {
    All: '全部新闻', Recommended: '为您推荐', Following: '正在关注', Zaobao: '联合早报',
    '头图': '头图', Brave: 'Brave 官方', 'Top News': '头条新闻', 'Top Sources': '最大来源',
    Technology: '科技', Business: '商业', Culture: '文化', Gaming: '游戏', Home: '首页',
    Science: '科学', Sports: '体育', 'Tech News': '科技', Games: '游戏', News: '新闻'
  }

  return labels[channel] || channel
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
