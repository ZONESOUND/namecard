import { getR2Stream } from '@/lib/storage';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const key = `Images/${params.path.join('/')}`; // Reconstruct "Images/filename.jpg"

    const data = await getR2Stream(key);

    if (!data) {
        return new NextResponse('Not Found', { status: 404 });
    }

    // Convert WebStream to Response
    return new NextResponse(data.stream, {
        headers: {
            'Content-Type': data.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}
