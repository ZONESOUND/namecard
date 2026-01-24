import { encrypt } from '@/lib/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const body = await request.json();
    const { password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    if (password === adminPassword) {
        // Create session
        const session = await encrypt({ authenticated: true });

        // Set cookie
        cookies().set('session', session, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Incorrect password' }, { status: 401 });
}
