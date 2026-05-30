import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CHANNEL } from '../src/app-config.js'

test('首页默认打开联合早报频道', () => {
  assert.equal(DEFAULT_CHANNEL, 'Zaobao')
})
