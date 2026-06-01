import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Vercel Cron 每分钟预热联合早报稳定缓存键', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))

  assert.deepEqual(config.crons, [
    {
      path: '/api/zaobao',
      schedule: '* * * * *'
    }
  ])
})
