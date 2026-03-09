export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, model, queueId } = body ?? {};

    if (!apiKey || !queueId) {
      return new Response(JSON.stringify({ error: 'Missing apiKey or queueId.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
        delete_media_on_completion: true,
      }),
    });

    if (!veniceRes.ok) {
      let errorText: string;
      try { errorText = await veniceRes.text(); } catch { errorText = `Venice returned ${veniceRes.status}`; }
      return new Response(JSON.stringify({ error: errorText }), {
        status: veniceRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ct = veniceRes.headers.get('Content-Type') || '';

    if (ct.includes('audio/') || ct.includes('application/octet-stream')) {
      const headers = new Headers();
      headers.set('Content-Type', ct.split(';')[0].trim());
      const cl = veniceRes.headers.get('Content-Length');
      if (cl) headers.set('Content-Length', cl);
      headers.set('Content-Disposition', 'attachment; filename="vivmusic-track.mp3"');

      return new Response(veniceRes.body, { status: 200, headers });
    }

    let data: Record<string, unknown>;
    try {
      data = await veniceRes.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse Venice response.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (data.status === 'COMPLETED' && data.audio) {
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

    return new Response(JSON.stringify({ error: 'Audio not ready.', status: data.status }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
