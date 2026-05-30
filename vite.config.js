import { defineConfig } from 'vite'
import { collectZaobaoNews } from './src/zaobao.js'

let cachedZaobaoPayload = null

export default defineConfig({
  server: {
    host: '127.0.0.1'
  },
  preview: {
    host: '127.0.0.1'
  },
  plugins: [
    {
      name: 'local-zaobao-api',
      configureServer(server) {
        server.middlewares.use('/api/zaobao', async (_req, res) => {
          try {
            const payload = await collectZaobaoNews({ fallback: cachedZaobaoPayload })
            cachedZaobaoPayload = payload
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(payload))
          } catch (error) {
            res.statusCode = 502
            res.end(error.message || 'Zaobao fetch failed')
          }
        })
      }
    }
  ]
})
