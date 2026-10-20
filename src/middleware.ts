import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'warehouse_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Allow access to login page (let server component validate session expiration)
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // Protected paths: dashboard (/), editor (/editor), admin (/admin)
  const isProtected =
    pathname === '/' ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/admin');

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (e.g. .svg, .png, .jpg)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
