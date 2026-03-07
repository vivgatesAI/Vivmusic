import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a world-class songwriting assistant for an AI music studio. Write clear, usable draft lyrics that fit the brief. Avoid copyrighted imitation. Return compact JSON only.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, title, brief, useCase, lyricNotes, optimizedPrompt } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }

    if (!brief) {
      return NextResponse.json({ error: 'Missing creative brief.' }, { status: 400 });
    }

    const prompt = [
      `Project title: ${title || 'Untitled'}`,
      `Use case: ${useCase || 'General music creation'}`,
      `Creative brief: ${brief}`,
      `Lyric notes: ${lyricNotes || 'No lyric notes provided.'}`,
      `Optimized prompt context: ${optimizedPrompt || 'None yet.'}`,
      '',
      'Return JSON with this exact shape:',
      '{',
      '  "title": string,',
      '  "hook": string,',
      '  "sections": string[],',
      '  "performanceNotes": string[]',
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
        temperature: 0.8,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'lyrics_draft',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                hook: { type: 'string' },
                sections: { type: 'array', items: { type: 'string' } },
                performanceNotes: { type: 'array', items: { type: 'string' } }
              },
              required: ['title', 'hook', 'sections', 'performanceNotes']
            }
          }
        }
      })
    });

    if (!veniceResponse.ok) {
      const text = await veniceResponse.text();
      return NextResponse.json({ error: text || 'Venice lyrics request failed.' }, { status: veniceResponse.status });
    }

    const data = await veniceResponse.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No lyrics content returned from Venice.' }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
