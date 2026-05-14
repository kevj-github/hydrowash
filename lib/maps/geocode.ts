export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' || !data.results[0]) return null

  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng, formattedAddress: data.results[0].formatted_address }
}
