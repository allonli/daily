import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { collectSnapshot, renderSnapshotDocument } from '../src/snapshot.js'

const template = await readFile('dist/index.html', 'utf8')
const snapshot = await collectSnapshot()
await mkdir('.cache', { recursive: true })
await writeFile('.cache/news.json', JSON.stringify(snapshot))
await writeFile('dist/template.html', template)
await writeFile('dist/index.html', renderSnapshotDocument(template, snapshot))
console.log(`已生成静态首页：早报 ${snapshot.zaobao.latest.length + 1} 条，Brave ${snapshot.news.length} 条，来源 ${snapshot.sources.length} 个`)
