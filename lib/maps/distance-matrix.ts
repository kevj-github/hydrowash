export interface LatLng {
  lat: number
  lng: number
}

export async function getDistanceMatrix(locations: LatLng[]): Promise<number[][]> {
  if (locations.length === 0) return []

  const key = process.env.GOOGLE_MAPS_API_KEY
  const coords = locations.map(l => `${l.lat},${l.lng}`).join('|')
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(coords)}` +
    `&destinations=${encodeURIComponent(coords)}` +
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
