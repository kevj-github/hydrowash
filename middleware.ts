import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  const requireRole = async (role: string) => {
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== role) return NextResponse.redirect(new URL('/', request.url))
    return null
  }

  if (pathname.startsWith('/admin')) {
    const redirect = await requireRole('admin')
    if (redirect) return redirect
  }

  if (pathname.startsWith('/account') || pathname.startsWith('/book')) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/auth/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      )
    }

    // Customers must have an address on file before they can book
    if (pathname.startsWith('/book')) {
      const { data: profile } = await supabase
        .from('profiles').select('address').eq('id', user.id).single()
      if (!profile?.address) {
        return NextResponse.redirect(new URL('/account/settings?reason=address', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/book'],
}
