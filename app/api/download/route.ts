import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, fileName, format } = body;

    if (!content || !fileName) {
      return NextResponse.json({ error: 'Missing content or fileName' }, { status: 400 });
    }

    const BOM = "\uFEFF";
    const mimeType = format === 'txt' ? 'text/plain' : 'text/csv';
    const fileContent = BOM + content;

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': `${mimeType}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
