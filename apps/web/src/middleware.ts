import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOOK_HOSTS = new Set(['book.k2chicken.com', 'www.book.k2chicken.com']);

export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();

  // Branded pre-order domain: send customers straight to the booking form.
  if (BOOK_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = '/book';
      return NextResponse.redirect(url, 308);
    }
    // Keep /book and /book/track on this host; send everything else to the form.
    if (!pathname.startsWith('/book') && !pathname.startsWith('/_next') && pathname !== '/favicon.svg') {
      const url = request.nextUrl.clone();
      url.pathname = '/book';
      url.search = search;
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }

  // Allow login and public routes
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // Redirect root - handled by page component
  if (request.nextUrl.pathname === '/') {
    return NextResponse.next();
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/pos', '/inventory', '/po', '/analytics', '/console', '/customers', '/delivery', '/settings'];
  const isProtected = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (isProtected) {
    // Check for auth token in cookie or header
    const token = request.cookies.get('accessToken')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    // If no token, allow through - client-side will handle redirect
    // (We can't read localStorage in middleware, so we check on client)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

