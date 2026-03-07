import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, brief } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }

    const response = await fetch('https://api.venice.ai/api/v1/image/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'z-image-turbo',
        prompt: `Minimal UI / Clean UI visual moodboard for a music creation studio. Clear, focused, sophisticated. White background, light gray surfaces, subtle cyan accents, abstract waveform and studio geometry, premium whitespace, elegant and calm. Project brief: ${brief || 'Music studio moodboard'}. No text.`,
        width: 1024,
        height: 768,
        style_preset: 'Minimalist',
        format: 'webp'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Venice image request failed.' }, { status: response.status });
    }

    const data = await response.json();
    const image = data?.images?.[0];

    if (!image) {
      return NextResponse.json({ error: 'No image returned from Venice.' }, { status: 500 });
    }

    return NextResponse.json({ dataUrl: `data:image/webp;base64,${image}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
