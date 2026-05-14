export interface LatLng {
  lat: number
  lng: number
}

const MAX_ELEMENTS = 25 // Google Distance Matrix allows up to 25 origins/destinations per request

async function fetchMatrix(
  origins: LatLng[],
  destinations: LatLng[],
  key: string
): Promise<number[][]> {
  const orig = origins.map(l => `${l.lat},${l.lng}`).join('|')
  const dest = destinations.map(l => `${l.lat},${l.lng}`).join('|')
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(orig)}` +
    `&destinations=${encodeURIComponent(dest)}` +
    `&mode=driving&key=${key}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix error: ${data.status}`)
  }

  return data.rows.map((row: { elements: { duration: { value: number } }[] }) =>
    row.elements.map(el => Math.ceil(el.duration.value / 60))
  )
}

export async function getDistanceMatrix(locations: LatLng[]): Promise<number[][]> {
  if (locations.length === 0) return []

  const key = process.env.GOOGLE_MAPS_API_KEY!
  const n = locations.length

  // If within limits, single request
  if (n <= MAX_ELEMENTS) {
    return fetchMatrix(locations, locations, key)
  }

  // Batch: build full n×n matrix by chunking origins
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i += MAX_ELEMENTS) {
    const originBatch = locations.slice(i, i + MAX_ELEMENTS)
    const subMatrix = await fetchMatrix(originBatch, locations, key)
    subMatrix.forEach((row, rowOffset) => {
      matrix[i + rowOffset] = row
    })
  }

  return matrix
}
