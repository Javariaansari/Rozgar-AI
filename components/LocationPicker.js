import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[280px] bg-gray-100 rounded border border-gray-300 animate-pulse" />
  ),
})

export default function LocationPicker({ value, onChange, required = false }) {
  const { location = '', latitude = null, longitude = null } = value || {}
  const [showMap, setShowMap] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [geoError, setGeoError] = useState('')
  const touchedRef = useRef(false)

  async function handleSearch() {
    const q = search.trim()
    if (!q) return
    setIsSearching(true)
    setGeoError('')
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults(data.results || [])
      if (!data.results?.length) {
        setGeoError('No places found. Try a city or area name.')
      }
    } catch (err) {
      setGeoError('Search failed. Please type the location manually.')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  function selectResult(result) {
    setSearchResults([])
    setSearch('')
    onChange({
      location: formatLocationName(result.name) || location,
      latitude: result.lat,
      longitude: result.lng,
    })
    setShowMap(true)
  }

  async function handlePick(lat, lng) {
    onChange({ ...value, latitude: lat, longitude: lng })
    if (!touchedRef.current) {
      try {
        const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        if (data.result?.name) {
          onChange({
            location: formatLocationName(data.result.name),
            latitude: lat,
            longitude: lng,
          })
        }
      } catch (err) {
        // Keep existing location text if reverse geocode fails
      }
    }
  }

  function handleLocationChange(e) {
    touchedRef.current = true
    onChange({ ...value, location: e.target.value })
  }

  function handleUseLocation() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoError('Location access is not available in this browser.')
      return
    }
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        onChange({ ...value, latitude: lat, longitude: lng })
        setShowMap(true)
        handlePick(lat, lng)
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Please allow location permission or pick on the map.'
            : 'Could not detect location. Pick on the map instead.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  function clearPin() {
    onChange({ ...value, latitude: null, longitude: null })
  }

  useEffect(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && !showMap) {
      // If coordinates exist (e.g. editing existing job), show map automatically
      setShowMap(true)
    }
  }, [latitude, longitude, showMap])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Location {required && <span className="text-red-500">*</span>}
      </label>

      <input
        value={location}
        onChange={handleLocationChange}
        placeholder="e.g. Lahore, Model Town"
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowMap((s) => !s)}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
        >
          {showMap ? 'Hide map' : '🗺️ Pick on map'}
        </button>
        <button
          type="button"
          onClick={handleUseLocation}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200"
        >
          📍 Use my location
        </button>
        {Number.isFinite(latitude) && Number.isFinite(longitude) && (
          <button
            type="button"
            onClick={clearPin}
            className="px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100"
          >
            Clear pin
          </button>
        )}
      </div>

      {Number.isFinite(latitude) && Number.isFinite(longitude) && (
        <p className="text-xs text-gray-500">
          Pin: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      )}

      {geoError && <p className="text-xs text-red-600">{geoError}</p>}

      {showMap && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search city or area"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !search.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded divide-y divide-gray-100 bg-white">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectResult(result)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  {result.name}
                </button>
              ))}
            </div>
          )}

          <LocationPickerMap lat={latitude} lng={longitude} onPick={handlePick} />
        </div>
      )}
    </div>
  )
}

function formatLocationName(name) {
  if (!name) return ''
  // Nominatim returns long comma-separated names; keep first few parts for readability
  const parts = name.split(',').map((p) => p.trim())
  return parts.slice(0, 3).join(', ')
}
