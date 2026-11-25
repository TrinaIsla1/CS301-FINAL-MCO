// Small in-memory limiter for the endpoints anyone can reach (sign-up checks, claim attempts).
// One server process only. Behind a proxy, set TRUST_PROXY so req.ip is the visitor, not the proxy.
export function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const k = key(req)
    const recent = (hits.get(k) || []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - recent[0])) / 1000)))
      return res
        .status(429)
        .json({ error: 'Too many attempts. Wait a few minutes and try again.' })
    }
    recent.push(now)
    hits.set(k, recent)
    if (hits.size > 5000) {
      for (const [kk, v] of hits) {
        if (!v.length || now - v[v.length - 1] >= windowMs) hits.delete(kk)
      }
    }
    next()
  }
}
