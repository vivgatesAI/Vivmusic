import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }

    const response = await fetch('https://api.venice.ai/api/v1/models?type=music', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text || 'Failed to fetch models.' }, { status: response.status });
    }

    const data = await response.json();

    const models = (data.data || [])
      .filter((m: Record<string, unknown>) => !((m.model_spec as Record<string, unknown>)?.offline))
      .map((m: Record<string, unknown>) => {
        const spec = m.model_spec as Record<string, unknown>;
        return {
          id: m.id,
          name: spec.name || m.id,
          description: spec.description || '',
          supportsLyrics: spec.supports_lyrics || false,
          lyricsRequired: spec.lyrics_required || false,
          supportsForceInstrumental: spec.supports_force_instrumental || false,
          durationOptions: spec.duration_options || null,
          minDuration: spec.min_duration || null,
          maxDuration: spec.max_duration || null,
          defaultDuration: spec.default_duration || 60,
          supportedFormats: spec.supported_formats || ['mp3'],
          defaultFormat: spec.default_format || 'mp3',
          promptCharacterLimit: spec.prompt_character_limit || 500,
          lyricsCharacterLimit: spec.lyrics_character_limit || null,
          minPromptLength: spec.min_prompt_length || 10,
          pricing: spec.pricing || {},
        };
      });

    return NextResponse.json({ models });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
