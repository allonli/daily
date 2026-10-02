import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { buildOutput } from '../scripts/build-output.js'

test('Vercel 输出包含可立即显示的首页、独立 ISR 模板和图片代理', async (t) => {
  const rootDir = await mkdtemp(join(process.cwd(), 'tests/.build-output-'))
  t.after(() => rm(rootDir, { recursive: true, force: true }))
  await mkdir(join(rootDir, 'dist/assets'), { recursive: true })
  await mkdir(join(rootDir, 'server'), { recursive: true })
  await mkdir(join(rootDir, 'api'), { recursive: true })

  const homepage = '<!doctype html><html><body>已生成的新闻</body></html>'
  const template = '<!doctype html><html><body><!-- 新闻模板 --></body></html>'
  await writeFile(join(rootDir, 'dist/index.html'), homepage)
  await writeFile(join(rootDir, 'dist/template.html'), template)
  await writeFile(join(rootDir, 'dist/assets/site.js'), 'window.siteReady = true')
  await writeFile(join(rootDir, 'server/message.js'), "export const message = '后台更新'\n")
  await writeFile(join(rootDir, 'server/index.js'), "import { readFile } from 'node:fs/promises'\nimport { message } from './message.js'\nexport default async (_req, res) => res.end(message + await readFile(new URL('./template.html', import.meta.url), 'utf8'))\n")
  await writeFile(join(rootDir, 'api/image.js'), "export default (_req, res) => res.status(200).send('image')\n")
  await mkdir(join(rootDir, '.vercel/output'), { recursive: true })
  await writeFile(join(rootDir, '.vercel/output/obsolete.txt'), 'old build')

  const outputDir = await buildOutput(rootDir)
  const functionsDir = join(outputDir, 'functions')
  const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

  assert.equal(await readFile(join(functionsDir, 'index.prerender-fallback.html'), 'utf8'), homepage)
  assert.equal(await readFile(join(functionsDir, 'index.func/template.html'), 'utf8'), template)
  assert.equal(await readFile(join(outputDir, 'static/assets/site.js'), 'utf8'), 'window.siteReady = true')
  await assert.rejects(stat(join(outputDir, 'static/index.html')), { code: 'ENOENT' })
  await assert.rejects(stat(join(outputDir, 'static/template.html')), { code: 'ENOENT' })
  await assert.rejects(stat(join(outputDir, 'obsolete.txt')), { code: 'ENOENT' })

  const prerenderConfig = await readJson(join(functionsDir, 'index.prerender-config.json'))
  assert.equal(prerenderConfig.expiration, 240)
  assert.deepEqual(prerenderConfig.allowQuery, [])
  assert.equal(prerenderConfig.fallback, 'index.prerender-fallback.html')
  assert.equal(prerenderConfig.initialHeaders['content-type'], 'text/html; charset=utf-8')
  assert.equal(prerenderConfig.initialStatus, 200)

  const pageConfig = await readJson(join(functionsDir, 'index.func/.vc-config.json'))
  assert.equal(pageConfig.runtime, 'nodejs22.x')
  assert.equal(pageConfig.handler, 'index.mjs')
  assert.equal(pageConfig.launcherType, 'Nodejs')
  assert.equal(pageConfig.maxDuration, 60)
  const imageConfig = await readJson(join(functionsDir, 'api/image.func/.vc-config.json'))
  assert.equal(imageConfig.shouldAddHelpers, true)

  const config = await readJson(join(outputDir, 'config.json'))
  assert.equal(config.version, 3)
  assert.equal(config.crons, undefined)
  assert.equal(config.routes[0].dest, '/index')
  assert.equal(new RegExp(config.routes[0].src).test('/'), true)
  assert.equal(new RegExp(config.routes[0].src).test('/index.html'), true)
  assert.equal(new RegExp(config.routes[0].src).test('/assets/site.js'), false)
  assert.deepEqual(config.routes[1], { handle: 'filesystem' })

  // 真实导入打包产物，确认函数的相对依赖已包含且默认 handler 可执行。
  const pageModule = await import(pathToFileURL(join(functionsDir, 'index.func/index.mjs')))
  let pageBody
  await pageModule.default({}, { end: (body) => { pageBody = body } })
  assert.equal(pageBody, `后台更新${template}`)
  const imageModule = await import(pathToFileURL(join(functionsDir, 'api/image.func/index.mjs')))
  let imageBody
  let imageStatus
  imageModule.default({}, {
    status: (status) => {
      imageStatus = status
      return { send: (body) => { imageBody = body } }
    }
  })
  assert.equal(imageStatus, 200)
  assert.equal(imageBody, 'image')
})
