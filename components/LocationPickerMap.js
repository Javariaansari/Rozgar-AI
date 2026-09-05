import { useEffect, useRef } from 'react'

const DEFAULT_CENTER = [30.3753, 69.3451] // Pakistan center
const DEFAULT_ZOOM = 5

export default function LocationPickerMap({ lat, lng, onPick, height = 280 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    let cancelled = false
    const init = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
      const center = hasCoords ? [lat, lng] : DEFAULT_CENTER
      const zoom = hasCoords ? 14 : DEFAULT_ZOOM

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="font-size:28px;line-height:1;transform:translate(-50%,-100%);text-shadow:0 1px 3px rgba(0,0,0,0.3);">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })

      const marker = L.marker(center, {
        icon: pinIcon,
        draggable: true,
      }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onPick(pos.lat, pos.lng)
      })

      map.on('click', (e) => {
        const { lat: newLat, lng: newLng } = e.latlng
        marker.setLatLng([newLat, newLng])
        onPick(newLat, newLng)
      })

      mapRef.current = map
      markerRef.current = marker
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [lat, lng, onPick])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
    if (hasCoords) {
      marker.setLatLng([lat, lng])
      map.setView([lat, lng], Math.max(map.getZoom(), 14))
    }
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      className="w-full rounded border border-gray-300"
      style={{ height: `${height}px` }}
    />
  )
}
