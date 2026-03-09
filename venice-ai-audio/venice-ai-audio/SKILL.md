---
name: venice-ai-audio
description: Generate AI music and audio using the Venice AI async audio queue API. Use this skill whenever the user wants to generate music, songs, or AI-produced audio via Venice AI, use the elevenlabs-music model, call /audio/queue or /audio/retrieve or /audio/complete or /audio/quote endpoints, check audio generation pricing, poll for audio results, or build any workflow that produces audio files from Venice. Trigger even for casual phrases like "make a song", "generate background music", "create audio", or "how much does Venice audio cost". Always use this skill when the Venice audio API is involved — do not attempt to call these endpoints from memory.
---

# Venice AI — Async Audio Generation Skill

This skill covers the full 4-step Venice audio API workflow:
**Quote → Queue → Retrieve (poll) → Complete**

> For TTS (text-to-speech) and transcription, see the companion `venice-ai` skill.
> This skill covers the music/audio generation queue API only.

## Prerequisites

- Venice API key set as `VENICE_API_KEY` environment variable
- Python 3.10+ (for the helper script)

## The 4-Step Workflow

### Step 1 — Quote (optional but recommended)

Get a price estimate before generating.

```bash
python3 SKILL_DIR/scripts/audio.py quote \
  --model elevenlabs-music \
  --duration 60 \
  --chars 200
```

Or via curl:
```bash
curl -s -X POST https://api.venice.ai/api/v1/audio/quote \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"elevenlabs-music","duration_seconds":60,"character_count":200}'
```

Returns: `{ "quote": 0.75 }` — estimated USD cost.

---

### Step 2 — Queue (submit generation)

```bash
python3 SKILL_DIR/scripts/audio.py queue \
  --model elevenlabs-music \
  --prompt "Upbeat electronic track for a product launch" \
  --duration 60
```

With optional parameters:
```bash
python3 SKILL_DIR/scripts/audio.py queue \
  --model elevenlabs-music \
  --prompt "Warm cinematic background music" \
  --lyrics "Verse 1: Walking through the city lights..." \
  --duration 60 \
  --voice Aria \
  --speed 1.0
```

Returns: `queue_id` — save this for polling.

**Key parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `model` | string | Required. e.g. `elevenlabs-music` |
| `prompt` | string | Required. Describes the audio to generate |
| `lyrics_prompt` | string | Optional. Lyrics for lyric-capable models |
| `duration_seconds` | int | Optional. Model default used if omitted |
| `force_instrumental` | bool | Optional. Suppresses vocals when supported |
| `voice` | string | Optional. See `/models?type=music` for voices |
| `speed` | float | Optional. Range `0.25–4.0` |

---

### Step 3 — Retrieve (poll until done)

```bash
python3 SKILL_DIR/scripts/audio.py retrieve \
  --model elevenlabs-music \
  --queue-id 123e4567-e89b-12d3-a456-426614174000 \
  --output /tmp/generated_audio.mp3
```

The script auto-polls every 3 seconds until complete, then saves the audio file.

**Status values:**
- `QUEUED` — waiting in queue
- `PROCESSING` — currently generating
- `COMPLETED` — audio ready (response includes audio data)
- `FAILED` — generation failed

Response while processing:
```json
{
  "status": "PROCESSING",
  "average_execution_time": 20000,
  "execution_duration": 5200
}
```

---

### Step 4 — Complete (cleanup)

After downloading your audio, free Venice's stored media:

```bash
python3 SKILL_DIR/scripts/audio.py complete \
  --model elevenlabs-music \
  --queue-id 123e4567-e89b-12d3-a456-426614174000
```

Returns: `{ "success": true }`

> **Note:** Skip this step if you set `delete_media_on_completion: true` in the retrieve request — Venice cleans up automatically in that case.

---

## End-to-End Example (single command)

The helper script supports a `generate` command that runs the full workflow:

```bash
python3 SKILL_DIR/scripts/audio.py generate \
  --model elevenlabs-music \
  --prompt "Dramatic orchestral intro, building tension" \
  --duration 30 \
  --output /tmp/my_track.mp3
```

This will: quote → queue → poll → retrieve → complete — all in one shot.

---

## Common Use Cases

### Background Music
```bash
python3 SKILL_DIR/scripts/audio.py generate \
  --prompt "Calm lo-fi hip hop, study music, gentle piano" \
  --duration 120 --output /tmp/lofi.mp3
```

### Song with Lyrics
```bash
python3 SKILL_DIR/scripts/audio.py generate \
  --prompt "Upbeat pop song about transformation" \
  --lyrics "Verse 1: Every day a new beginning..." \
  --duration 90 --output /tmp/song.mp3
```

### Instrumental Only
```bash
python3 SKILL_DIR/scripts/audio.py generate \
  --prompt "Epic cinematic score, no vocals" \
  --force-instrumental --duration 60 --output /tmp/score.mp3
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `VENICE_API_KEY not set` | Export your key: `export VENICE_API_KEY=vn_...` |
| Model not found | Check available models at `/models?type=music` |
| `lyrics_required` error | Model requires `lyrics_prompt` — add it |
| `supports_lyrics=false` | Remove `lyrics_prompt` for this model |
| Long wait times | Check `average_execution_time` in retrieve response |
| `success: false` on complete | Retry — transient cleanup failure |

---

## Full API Reference

See `references/api.md` in this skill for complete endpoint specs, all response schemas, and model capability flags.
