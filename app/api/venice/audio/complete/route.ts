import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, queueId } = body ?? {};

    if (!apiKey || !queueId) {
      return NextResponse.json({ error: 'Missing apiKey or queueId.' }, { status: 400 });
    }

    const veniceRes = await fetch('https://api.venice.ai/api/v1/audio/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'elevenlabs-music',
        queue_id: queueId,
      }),
    });

    if (!veniceRes.ok) {
      return NextResponse.json({ success: false }, { status: veniceRes.status });
    }

    const data = await veniceRes.json();
    return NextResponse.json({ success: data.success ?? true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
