import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    let content = '';
    let fileName = '';
    let format = '';

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      content = body.content;
      fileName = body.fileName;
      format = body.format;
    } else {
      // Handles native <form> submit
      const formData = await request.formData();
      content = formData.get('content') as string;
      fileName = formData.get('fileName') as string;
      format = formData.get('format') as string;
    }

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
