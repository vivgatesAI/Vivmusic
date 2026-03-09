# Venice AI Audio API — Full Reference

## Base URL
`https://api.venice.ai/api/v1`

## Authentication
All requests require:
```
Authorization: Bearer <VENICE_API_KEY>
Content-Type: application/json
```

---

## Endpoints

### POST /audio/quote

Estimate cost before generating. Call this first to avoid surprise charges.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Model ID, e.g. `elevenlabs-music` |
| `duration_seconds` | int or string | ❌ | Duration hint in seconds. Omit to use model default |
| `character_count` | int | ❌ | Required for character-priced models |

**Example request:**
```json
{
  "model": "elevenlabs-music",
  "duration_seconds": 60,
  "character_count": 100
}
```

**Response:**
```json
{
  "quote": 0.75
}
```
`quote` is estimated USD cost.

---

### POST /audio/queue

Submit an audio generation request. Returns immediately with a `queue_id`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Model ID |
| `prompt` | string | ✅ | Audio description. Min/max length varies by model |
| `lyrics_prompt` | string | ❌ | Lyrics text. Required when model has `lyrics_required=true` |
| `duration_seconds` | int or string | ❌ | Duration hint. Uses model default if omitted |
| `force_instrumental` | boolean | ❌ | Only when model has `supports_force_instrumental=true` |
| `voice` | string | ❌ | Voice selection. See model's `voices` and `default_voice` |
| `speed` | float | ❌ | Speed multiplier. Range: `0.25–4.0`. Only when `supports_speed=true` |

**Example request:**
```json
{
  "model": "elevenlabs-music",
  "prompt": "A warm spoken narration introducing a product launch.",
  "lyrics_prompt": "Verse 1: Walking through the city lights...",
  "duration_seconds": 60,
  "force_instrumental": false,
  "voice": "Aria",
  "speed": 1
}
```

**Response:**
```json
{
  "model": "elevenlabs-music",
  "queue_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "QUEUED"
}
```

---

### POST /audio/retrieve

Poll this endpoint with your `queue_id` until generation completes.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Model ID used in queue request |
| `queue_id` | string | ✅ | ID returned from `/audio/queue` |
| `delete_media_on_completion` | boolean | ❌ | Default: `false`. If `true`, Venice deletes media after retrieval — skip `/audio/complete` |

**Response while processing:**
```json
{
  "status": "PROCESSING",
  "average_execution_time": 20000,
  "execution_duration": 5200
}
```

`average_execution_time` — P80 estimate in milliseconds  
`execution_duration` — how long this request has been running in milliseconds

**Response when complete:**
```json
{
  "status": "COMPLETED",
  "audio": "<base64-encoded audio data>",
  "content_type": "audio/mpeg"
}
```

**Status lifecycle:**
```
QUEUED → PROCESSING → COMPLETED
                    ↘ FAILED
```

**Recommended polling interval:** 3–5 seconds. Use `execution_duration` vs `average_execution_time` to gauge how close you are.

---

### POST /audio/complete

Clean up stored media after you've downloaded the audio.

**When to call:**
- After successfully saving the audio file
- Only if you did NOT use `delete_media_on_completion: true` in `/audio/retrieve`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Model ID |
| `queue_id` | string | ✅ | Queue ID of the completed request |

**Example request:**
```json
{
  "model": "elevenlabs-music",
  "queue_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true
}
```

`success: false` means cleanup failed but can be retried. Not a critical error.

---

## Model Capability Flags

When calling `/models?type=music`, inspect these fields to know which optional parameters a model supports:

| Flag | Meaning |
|------|---------|
| `lyrics_required` | Must include `lyrics_prompt` |
| `supports_lyrics` | Can accept `lyrics_prompt` (optional) |
| `supports_force_instrumental` | Can suppress vocals |
| `supports_speed` | Accepts `speed` parameter; check `min_speed`/`max_speed` |
| `voices` | List of valid voice names |
| `default_voice` | Default voice if none specified |
| `pricing.per_thousand_characters` | Uses `character_count` for pricing |
| `min_prompt_length` | Minimum characters for `prompt` |
| `prompt_character_limit` | Maximum characters for `prompt` |

---

## Full Workflow Sequence

```
1. GET /models?type=music       → Discover models + capabilities
2. POST /audio/quote            → Estimate cost (optional)
3. POST /audio/queue            → Submit request → get queue_id
4. POST /audio/retrieve (loop)  → Poll until status = COMPLETED
5. Download audio from response → Save to file
6. POST /audio/complete         → Clean up storage
```

---

## Pricing Notes

- Music generation pricing is typically per-second of audio
- Some models price per thousand characters (check `pricing.per_thousand_characters`)
- Always call `/audio/quote` before large or long generations
- Costs billed in Venice Diem (VCU) or USD depending on account type
