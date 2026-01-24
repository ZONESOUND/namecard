import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

export async function middleware(request) {
    const path = request.nextUrl.pathname;

    // Define public paths that don't satisfy authentication
    const isPublicPath = path === '/login' || path.startsWith('/api/login');

    // Skip middleware for static files and images
    if (
        path.startsWith('/_next') ||
        path.startsWith('/static') ||
        path.includes('.') // Crude check for files like favicon.ico, images
    ) {
        return NextResponse.next();
    }

    // Check for session cookie
    const cookie = request.cookies.get('session')?.value;
    let session = null;
    if (cookie) {
        try {
            session = await decrypt(cookie);
        } catch (e) {
            session = null;
        }
    }

    // Redirect Logic
    // 1. If trying to access public path (Login) but already logged in -> Redirect to Home
    if (isPublicPath && session) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
    }

    // 2. If trying to access protected path (Home) but not logged in -> Redirect to Login
    if (!isPublicPath && !session) {
        return NextResponse.redirect(new URL('/login', request.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
