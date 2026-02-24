import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const csvContent = formData.get('csvContent') as string;
    const fileName = formData.get('fileName') as string;

    if (!csvContent || !fileName) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Add UTF-8 BOM so CSV opens correctly in Excel/LibreOffice
    const bom = '\uFEFF';
    const fullContent = bom + csvContent;
    const buffer = Buffer.from(fullContent, 'utf-8');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
