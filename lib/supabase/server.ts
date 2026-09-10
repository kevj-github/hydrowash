import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Memoizes auth.getUser() for the lifetime of one request (React's cache()
// dedupes calls within a single Server Component render pass). This does
// NOT remove any authorization check anywhere — every call site still runs
// its own guard/redirect logic — it just avoids a second network round trip
// to Supabase Auth when a layout and its child page (or middleware and a
// server component) each independently need the current user in the same
// request. Middleware runs in the Edge runtime as a separate process, so it
// is not and cannot be deduped by this.
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
