import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function safeNext(value: string | null, fallback: string): string {
  if (!value) return fallback
  let decoded = value
  // Check every encoding layer so encoded separators and controls cannot bypass validation.
  for (;;) {
    if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(decoded)) {
      return fallback
    }
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return value
      decoded = next
    } catch {
      return fallback
    }
  }
}

export async function GET(request: NextRequest) {
  const invalid = () => {
    const response = NextResponse.redirect(new URL('/login?error=link_invalid_or_expired', request.url))
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
  const { searchParams } = request.nextUrl
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  if (!token_hash || (type !== 'magiclink' && type !== 'email' && type !== 'recovery' && type !== 'invite')) {
    return invalid()
  }

  const destination = safeNext(searchParams.get('next'), type === 'recovery' ? '/reset-password' : '/')
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.headers.set('Cache-Control', 'no-store')
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      },
    )
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (error) return invalid()
    return response
  } catch {
    return invalid()
  }
}
