import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { defineConfig } from 'vite'
import { collectSnapshot, isValidSnapshot, renderSnapshotDocument } from './src/snapshot.js'

let devSnapshot

export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  plugins: [{
    name: 'static-news-development',
    apply: 'serve',
    async configureServer() {
      try {
        devSnapshot = JSON.parse(await readFile('.cache/news.json', 'utf8'))
        if (!isValidSnapshot(devSnapshot)) throw new Error('快照不完整')
      } catch {
        devSnapshot = await collectSnapshot()
        await mkdir('.cache', { recursive: true })
        await writeFile('.cache/news.json', JSON.stringify(devSnapshot))
      }
    },
    transformIndexHtml(html) {
      return renderSnapshotDocument(html, devSnapshot, { production: false })
    }
  }]
})
