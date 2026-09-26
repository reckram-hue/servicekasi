import { NextResponse, type NextRequest } from 'next/server';

// Quick first check: no session cookie → go to the login page. The real
// check (is the session valid, which business, which role) happens in
// requireAuth() on each page, because Proxy must stay fast and can't be the
// only line of defence.
// /q/<token> is the client-facing quote approval page — no login, reached via
// a WhatsApp link, so it must stay public.
const PUBLIC_PATHS = ['/login', '/signup', '/q'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = request.cookies.has('sk_session');

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals, API routes, and static files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
