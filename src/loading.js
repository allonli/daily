export function renderZaobaoLoadingSection() {
  return `
    <section class="feed-section zaobao-section zaobao-loading" aria-busy="true">
      <div class="feed-section-heading">
        <h2>联合早报</h2>
        <span class="loading-status">正在加载联合早报<span class="loading-dot">.</span><span class="loading-dot">.</span><span class="loading-dot">.</span></span>
      </div>
      <div class="feed-section-list loading-skeleton-list">
        <article class="loading-skeleton-card loading-skeleton-lead">
          <div class="skeleton-media"></div>
          <div class="skeleton-line skeleton-meta"></div>
          <div class="skeleton-line skeleton-title"></div>
        </article>
        ${Array.from({ length: 4 }, () => `
          <article class="loading-skeleton-card">
            <div class="skeleton-copy">
              <div class="skeleton-line skeleton-meta"></div>
              <div class="skeleton-line skeleton-title"></div>
            </div>
            <div class="skeleton-thumb"></div>
          </article>
        `).join('')}
      </div>
    </section>
  `
}
