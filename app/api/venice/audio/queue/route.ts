import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, prompt, lyricsPrompt, durationSeconds, forceInstrumental } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'Missing music prompt.' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      model: model || 'elevenlabs-music',
      prompt,
    };

    if (durationSeconds) payload.duration_seconds = durationSeconds;
    if (forceInstrumental) payload.force_instrumental = true;
    if (lyricsPrompt) payload.lyrics_prompt = lyricsPrompt;

    const response = await fetch('https://api.venice.ai/api/v1/audio/queue', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Venice audio queue request failed.' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ queueId: data.queue_id, status: data.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
