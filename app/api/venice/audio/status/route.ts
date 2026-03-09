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

    const response = await fetch('https://api.venice.ai/api/v1/audio/retrieve', {
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

    if (!response.ok) {
      let errorText: string;
      try {
        errorText = await response.text();
      } catch {
        errorText = `Venice returned ${response.status}`;
      }
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    let data: Record<string, unknown>;
    try {
      const rawText = await response.text();
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Failed to parse Venice response.' }, { status: 502 });
    }

    if (data.status === 'COMPLETED') {
      if (downloadAudio && data.audio) {
        const contentType = (data.content_type as string) || 'audio/mpeg';
        const audioBuffer = Buffer.from(data.audio as string, 'base64');
        return new Response(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(audioBuffer.length),
            'Content-Disposition': 'attachment; filename="vivmusic-track.mp3"',
          },
        });
      }

      return NextResponse.json({
        status: 'COMPLETED',
        contentType: (data.content_type as string) || 'audio/mpeg',
      });
    }

    if (data.status === 'FAILED') {
      return NextResponse.json({ status: 'FAILED', error: 'Generation failed on Venice side.' });
    }

    return NextResponse.json({
      status: data.status,
      averageExecutionTime: data.average_execution_time,
      executionDuration: data.execution_duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
