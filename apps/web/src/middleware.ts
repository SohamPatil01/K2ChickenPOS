import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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

