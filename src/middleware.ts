import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name }) => request.cookies.set(name, ''))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Paths that do NOT require auth
  const PUBLIC_PATHS = ['/login', '/register', '/face-setup']
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // Admin-only paths
  const isAdminPath = pathname.startsWith('/admin')

  // Student-only paths
  const STUDENT_PATHS = ['/dashboard', '/exam', '/practice', '/mistakes', '/history', '/leaderboard']
  const isStudentPath = STUDENT_PATHS.some(p => pathname.startsWith(p))

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
  const isAdmin = user?.email?.toLowerCase() === adminEmail?.toLowerCase()

  // No user — redirect to login only for protected paths
  if (!user && (isStudentPath || isAdminPath)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Logged in user trying to access auth pages → redirect to appropriate home
  if (user && isPublicPath) {
    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Non-admin trying to access admin path → redirect to dashboard
  if (user && isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  // Only run on real page routes — exclude API, static files, images, and _next internals
  matcher: [
    '/login',
    '/register',
    '/face-setup',
    '/dashboard/:path*',
    '/exam/:path*',
    '/practice/:path*',
    '/mistakes/:path*',
    '/history/:path*',
    '/leaderboard/:path*',
    '/admin/:path*',
  ],
}
