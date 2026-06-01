import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CHANNEL, PRESET_CHANNELS, SIDEBAR_CHANNELS } from '../src/app-config.js'

test('首页默认打开联合早报频道', () => {
  assert.equal(DEFAULT_CHANNEL, 'Zaobao')
})

test('侧栏只保留联合早报作为顶部入口', () => {
  assert.deepEqual(PRESET_CHANNELS.map((item) => item.id), ['Zaobao'])
})

test('侧栏频道移除 Brave 官方和首页', () => {
  assert.deepEqual(SIDEBAR_CHANNELS, ['Business', 'Gaming', 'Science', 'Top News', 'Top Sources'])
})
