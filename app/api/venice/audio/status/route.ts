import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, queueId } = body ?? {};

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
        delete_media_on_completion: false,
      }),
    });

    if (!veniceRes.ok) {
      const status = veniceRes.status;
      let errorText: string;
      try {
        errorText = await veniceRes.text();
      } catch {
        errorText = `Venice returned ${status}`;
      }
      return NextResponse.json({ error: errorText }, { status });
    }

    const ct = veniceRes.headers.get('Content-Type') || '';

    if (ct.includes('audio/') || ct.includes('application/octet-stream')) {
      try { veniceRes.body?.cancel(); } catch { /* ignore */ }
      return NextResponse.json({ status: 'COMPLETED' });
    }

    let data: Record<string, unknown>;
    try {
      data = await veniceRes.json();
    } catch {
      return NextResponse.json({ error: 'Failed to parse Venice response.' }, { status: 502 });
    }

    if (data.status === 'COMPLETED') {
      return NextResponse.json({ status: 'COMPLETED' });
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
