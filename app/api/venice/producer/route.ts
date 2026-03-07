import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a world-class AI music producer helping users develop tracks like professionals. Return compact JSON only. Be specific, practical, and music-focused. Avoid copyrighted imitation. Help with structure, mood, instrumentation, lyrics direction, and refinement steps.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, title, brief, useCase, mode, tags, lyricNotes } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }

    if (!brief) {
      return NextResponse.json({ error: 'Missing creative brief.' }, { status: 400 });
    }

    const prompt = [
      `Project title: ${title || 'Untitled'}`,
      `Use case: ${useCase || 'General music creation'}`,
      `Mode: ${mode || 'Guided Pro'}`,
      `Tags: ${Array.isArray(tags) ? tags.join(', ') : ''}`,
      `Lyric notes: ${lyricNotes || 'None provided'}`,
      `Creative brief: ${brief}`,
      '',
      'Return JSON with this exact shape:',
      '{',
      '  "optimizedPrompt": string,',
      '  "arrangement": string[],',
      '  "instrumentation": string[],',
      '  "lyricsDirection": string[],',
      '  "producerNotes": string[],',
      '  "nextRefinements": string[]',
      '}'
    ].join('\n');

    const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'music_producer_plan',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                optimizedPrompt: { type: 'string' },
                arrangement: { type: 'array', items: { type: 'string' } },
                instrumentation: { type: 'array', items: { type: 'string' } },
                lyricsDirection: { type: 'array', items: { type: 'string' } },
                producerNotes: { type: 'array', items: { type: 'string' } },
                nextRefinements: { type: 'array', items: { type: 'string' } }
              },
              required: ['optimizedPrompt', 'arrangement', 'instrumentation', 'lyricsDirection', 'producerNotes', 'nextRefinements']
            }
          }
        }
      })
    });

    if (!veniceResponse.ok) {
      const text = await veniceResponse.text();
      return NextResponse.json({ error: text || 'Venice request failed.' }, { status: veniceResponse.status });
    }

    const data = await veniceResponse.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content returned from Venice.' }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
