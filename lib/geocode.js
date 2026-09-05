const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'RozgarAI/1.0 (contact@rozgar.ai)'

const cache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
let lastRequestTime = 0
const MIN_INTERVAL_MS = 1100 // Nominatim policy: max 1 request/sec

function cacheKey(type, params) {
  return `${type}:${JSON.stringify(params)}`
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCached(key, value) {
  cache.set(key, { value, ts: Date.now() })
}

async function throttle() {
  const now = Date.now()
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime))
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastRequestTime = Date.now()
}

async function nominatimFetch(url) {
  await throttle()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Geocoder returned ${res.status}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export async function searchPlaces(q) {
  const normalized = q?.trim().toLowerCase()
  if (!normalized || normalized.length < 2) return []

  const key = cacheKey('search', normalized)
  const cached = getCached(key)
  if (cached) return cached

  const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(normalized)}&countrycodes=pk&limit=5&addressdetails=1&accept-language=en`
  const data = await nominatimFetch(url)
  const results = Array.isArray(data)
    ? data.map((item) => ({
        name: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        boundingbox: item.boundingbox,
      }))
    : []
  setCached(key, results)
  return results
}

export async function reverseGeocode(lat, lng) {
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null

  const key = cacheKey('reverse', `${latNum.toFixed(4)},${lngNum.toFixed(4)}`)
  const cached = getCached(key)
  if (cached) return cached

  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}&zoom=16&accept-language=en`
  const data = await nominatimFetch(url)
  const result = data?.display_name
    ? {
        name: formatAddress(data.address, data.display_name),
        lat: latNum,
        lng: lngNum,
      }
    : null
  setCached(key, result)
  return result
}

function formatAddress(address, fallback) {
  if (!address) return fallback
  const parts = []
  if (address.suburb || address.neighbourhood || address.residential) {
    parts.push(address.suburb || address.neighbourhood || address.residential)
  }
  if (address.city || address.town || address.village || address.county) {
    parts.push(address.city || address.town || address.village || address.county)
  }
  if (address.state) {
    parts.push(address.state)
  }
  return parts.length > 0 ? parts.join(', ') : fallback
}
