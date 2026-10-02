import { build } from 'esbuild'
import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)

export async function buildOutput(rootDir = resolve(dirname(scriptPath), '..')) {
  const distDir = join(rootDir, 'dist')
  const outputDir = join(rootDir, '.vercel/output')
  const functionsDir = join(outputDir, 'functions')
  const pageFunctionDir = join(functionsDir, 'index.func')
  const imageFunctionDir = join(functionsDir, 'api/image.func')

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(pageFunctionDir, { recursive: true })
  await mkdir(imageFunctionDir, { recursive: true })

  // 首页由 ISR 保存完整 HTML；构建模板仅供后台再生成，不能公开访问。
  await cp(distDir, join(outputDir, 'static'), {
    recursive: true,
    filter: (path) => path !== join(distDir, 'index.html') && path !== join(distDir, 'template.html')
  })
  await copyFile(join(distDir, 'index.html'), join(functionsDir, 'index.prerender-fallback.html'))
  await copyFile(join(distDir, 'template.html'), join(pageFunctionDir, 'template.html'))

  await build({
    entryPoints: [join(rootDir, 'server/index.js')],
    outfile: join(pageFunctionDir, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm'
  })
  await build({
    entryPoints: [join(rootDir, 'api/image.js')],
    outfile: join(imageFunctionDir, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm'
  })

  const functionConfig = {
    runtime: 'nodejs22.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    maxDuration: 60
  }
  await writeJson(join(pageFunctionDir, '.vc-config.json'), functionConfig)
  await writeJson(join(imageFunctionDir, '.vc-config.json'), {
    ...functionConfig,
    shouldAddHelpers: true
  })
  await writeJson(join(functionsDir, 'index.prerender-config.json'), {
    // 五分钟定时请求前让缓存过期，避免生成耗时把下一次更新推迟到十分钟。
    expiration: 240,
    allowQuery: [],
    fallback: 'index.prerender-fallback.html',
    initialHeaders: { 'content-type': 'text/html; charset=utf-8' },
    initialStatus: 200
  })
  await writeJson(join(outputDir, 'config.json'), {
    version: 3,
    routes: [
      { src: '^/(?:index\\.html)?$', dest: '/index' },
      { handle: 'filesystem' }
    ]
  })

  return outputDir
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await buildOutput()
}
