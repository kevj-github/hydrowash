import { NextRequest, NextResponse } from 'next/server'

// NOTE: intentionally unauthenticated — the public booking wizard's "My Location"
// button (components/booking/StepScheduleLocation.tsx) calls this for logged-out
// visitors. Do NOT add an auth gate here; it silently breaks guest bookings.
// Unlike /api/geocode (forward), which is only reached by signed-in users.
export async function POST(request: NextRequest) {
  const { lat, lng } = await request.json()
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Maps API not configured' }, { status: 500 })
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&region=sg&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const result = data.results[0]
  const address: string = result.formatted_address ?? ''
  const postalComp = result.address_components?.find((c: { types: string[] }) =>
    c.types.includes('postal_code')
  )
  const postalCode: string = postalComp?.short_name ?? ''

  return NextResponse.json({ address, postalCode })
}
