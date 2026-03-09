import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a world-class AI music producer. The user will give you a casual description of the music they want. Your job is to rewrite it into a concise, detailed, professional music production prompt optimized for an AI music generation model. Include genre, instrumentation, mood, tempo, structure, and sonic character. Return ONLY the optimized prompt text as a JSON string — no explanation.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      apiKey,
      description,
      genre,
      mood,
      duration,
      instrumental,
      lyrics,
      modelName,
      promptLimit,
    } = body ?? {};

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Venice API key.' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Missing music description.' }, { status: 400 });
    }

    const maxChars = promptLimit || 500;

    const parts = [`Music description: ${description}`];
    if (genre) parts.push(`Genre: ${genre}`);
    if (mood) parts.push(`Mood: ${mood}`);
    if (duration) parts.push(`Target duration: ${duration} seconds`);
    if (instrumental) parts.push('Style: Instrumental only, no vocals');
    if (lyrics) parts.push(`Include lyrics/vocal direction: ${lyrics}`);
    if (modelName) parts.push(`Target AI model: ${modelName}`);

    parts.push(
      '',
      `IMPORTANT: The optimized prompt must be under ${maxChars} characters.`,
      'Return JSON: { "optimizedPrompt": "your optimized prompt here" }',
    );

    const veniceResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'venice-uncensored',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: parts.join('\n') },
        ],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'optimized_prompt',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                optimizedPrompt: { type: 'string' },
              },
              required: ['optimizedPrompt'],
            },
          },
        },
      }),
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

    const parsed = JSON.parse(content);
    return NextResponse.json({ optimizedPrompt: parsed.optimizedPrompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
