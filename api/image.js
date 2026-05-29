export default async function handler(req, res) {
  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url

  if (!rawUrl) {
    res.status(400).send('Missing url')
    return
  }

  let imageUrl
  try {
    imageUrl = new URL(rawUrl)
  } catch {
    res.status(400).send('Invalid url')
    return
  }

  if (!['http:', 'https:'].includes(imageUrl.protocol)) {
    res.status(400).send('Unsupported url')
    return
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 Chrome/126 Safari/537.36'
      }
    })

    if (!upstream.ok) {
      res.status(upstream.status).send('Image fetch failed')
      return
    }

    const upstreamType = upstream.headers.get('content-type') || ''
    const imageBytes = normalizeImageBytes(Buffer.from(await upstream.arrayBuffer()))
    const contentType = detectContentType(imageBytes) || upstreamType || 'image/jpeg'

    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=604800')
    res.status(200).send(imageBytes)
  } catch {
    res.status(502).send('Image proxy failed')
  }
}

function normalizeImageBytes(bytes) {
  const imageStart = findImageStart(bytes)
  return imageStart > 0 ? bytes.subarray(imageStart) : bytes
}

function findImageStart(bytes) {
  const signatures = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from('GIF8'),
    Buffer.from('RIFF')
  ]

  for (const signature of signatures) {
    const index = bytes.indexOf(signature)
    if (index >= 0) {
      return index
    }
  }

  return 0
}

function detectContentType(bytes) {
  if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return 'image/png'
  }

  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg'
  }

  if (bytes.subarray(0, 4).equals(Buffer.from('GIF8'))) {
    return 'image/gif'
  }

  if (bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) {
    return 'image/webp'
  }

  return ''
}
