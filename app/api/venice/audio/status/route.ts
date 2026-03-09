import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, queueId } = body ?? {};

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
        model: 'elevenlabs-music',
        queue_id: queueId,
        delete_media_on_completion: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Venice audio retrieve failed.' }, { status: response.status });
    }

    const data = await response.json();

    if (data.status === 'COMPLETED') {
      return NextResponse.json({
        status: 'COMPLETED',
        audio: data.audio,
        contentType: data.content_type || 'audio/mpeg',
      });
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
