import { NextResponse } from 'next/server';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, queueId, downloadAudio } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }
    if (!queueId) {
      return NextResponse.json({ error: 'Missing queue ID.' }, { status: 400 });
    }

    const veniceRes = await fetch('https://api.venice.ai/api/v1/audio/retrieve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'elevenlabs-music',
        queue_id: queueId,
        delete_media_on_completion: !!downloadAudio,
      }),
    });

    if (!veniceRes.ok) {
      let errorText: string;
      try {
        errorText = await veniceRes.text();
      } catch {
        errorText = `Venice returned ${veniceRes.status}`;
      }
      return NextResponse.json({ error: errorText }, { status: veniceRes.status });
    }

    if (!downloadAudio) {
      return await handlePolling(veniceRes);
    }

    return await handleDownload(veniceRes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePolling(veniceRes: Response): Promise<Response> {
  const reader = veniceRes.body?.getReader();
  if (!reader) {
    return NextResponse.json({ error: 'Empty Venice response body.' }, { status: 502 });
  }

  const decoder = new TextDecoder();
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });

      const statusMatch = text.match(/"status"\s*:\s*"(\w+)"/);
      if (!statusMatch) continue;

      const status = statusMatch[1];

      if (status === 'COMPLETED') {
        await reader.cancel();
        return NextResponse.json({ status: 'COMPLETED' });
      }

      if (status === 'FAILED') {
        await reader.cancel();
        return NextResponse.json({ status: 'FAILED', error: 'Generation failed on Venice side.' });
      }
    }
    text += decoder.decode();
  } catch {
    return NextResponse.json({ error: 'Stream read error from Venice.' }, { status: 502 });
  }

  try {
    const data = JSON.parse(text);
    return NextResponse.json({
      status: data.status,
      averageExecutionTime: data.average_execution_time,
      executionDuration: data.execution_duration,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to parse Venice response.' }, { status: 502 });
  }
}

async function handleDownload(veniceRes: Response): Promise<Response> {
  let data: Record<string, unknown>;
  try {
    data = await veniceRes.json();
  } catch {
    return NextResponse.json({ error: 'Failed to parse Venice audio response.' }, { status: 502 });
  }

  if (data.status !== 'COMPLETED' || !data.audio) {
    return NextResponse.json(
      { error: 'Audio not ready.', status: data.status || 'UNKNOWN' },
      { status: 404 },
    );
  }

  const contentType = (data.content_type as string) || 'audio/mpeg';
  const base64 = data.audio as string;
  data.audio = null;

  const audioBuffer = Buffer.from(base64, 'base64');

  return new Response(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(audioBuffer.length),
      'Content-Disposition': 'attachment; filename="vivmusic-track.mp3"',
    },
  });
}
