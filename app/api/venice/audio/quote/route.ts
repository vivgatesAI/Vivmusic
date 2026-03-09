import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, durationSeconds } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }

    const response = await fetch('https://api.venice.ai/api/v1/audio/quote', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'elevenlabs-music',
        duration_seconds: durationSeconds || 60,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Venice quote request failed.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ quote: data.quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
