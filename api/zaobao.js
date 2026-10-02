import { collectZaobaoNews } from '../src/zaobao.js'

let cachedPayload = null

export default async function handler(req, res) {
  try {
    const payload = await collectZaobaoNews({ fallback: cachedPayload })
    cachedPayload = payload
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'public, max-age=60')
    res.setHeader('cdn-cache-control', 'public, s-maxage=180, stale-while-revalidate=900')
    res.setHeader('vercel-cdn-cache-control', 'public, s-maxage=180, stale-while-revalidate=900')
    res.status(200).send(JSON.stringify(payload))
  } catch (error) {
    res.status(502).send(error.message || 'Zaobao fetch failed')
  }
}
