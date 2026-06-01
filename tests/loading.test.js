import test from 'node:test'
import assert from 'node:assert/strict'
import { renderZaobaoLoadingSection } from '../src/loading.js'

test('联合早报加载态使用动态骨架屏', () => {
  const html = renderZaobaoLoadingSection()

  assert.match(html, /联合早报/)
  assert.match(html, /正在加载联合早报/)
  assert.equal((html.match(/loading-skeleton-card/g) || []).length, 5)
  assert.equal((html.match(/loading-dot/g) || []).length, 3)
})
