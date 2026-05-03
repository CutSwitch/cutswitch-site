# Social Reels API Contract

## Endpoint

`POST /api/social-reels/discover`

Authenticated app-facing endpoint. Requires:

`Authorization: Bearer <supabase_access_token>`

The server derives the user from the bearer token. Clients must not send or rely on `userId`.

## Request

```json
{
  "project_fingerprint": "privacy-safe-project-fingerprint",
  "source_duration_seconds": 3600,
  "duration_bucket": "mixed",
  "requested_candidate_count": 50,
  "custom_duration_seconds": null,
  "segments": [
    {
      "id": "seg-1",
      "start_seconds": 12.4,
      "end_seconds": 33.2,
      "speaker": "Speaker 1",
      "text": "Transcript segment text."
    }
  ],
  "context": {
    "platform": "social",
    "show_name": "Optional show name",
    "content_notes": "Optional safe editorial notes"
  }
}
```

## Request Fields

- `project_fingerprint`: optional privacy-safe fingerprint. Do not send raw file paths or project titles.
- `source_duration_seconds`: source media duration in seconds, max 24 hours.
- `duration_bucket`: requested pack. Allowed values:
  - `15s`
  - `30s`
  - `60s`
  - `90s`
  - `5-10m`
  - `mixed`
  - `custom`
- `requested_candidate_count`: optional. Defaults to `50`. Must be between `30` and `80`.
- `custom_duration_seconds`: required only when `duration_bucket` is `custom`.
- `segments`: 1 to 2000 transcript segments.
- `context`: optional safe metadata only.

## Custom Duration Shape

```json
{
  "custom_duration_seconds": {
    "min": 45,
    "max": 120
  }
}
```

Limits:

- `min`: 5 to 600 seconds
- `max`: 5 to 600 seconds
- `max` must be greater than or equal to `min`

## Response

```json
{
  "ok": true,
  "candidates": [
    {
      "candidate_id": "mock-reel-01",
      "title": "Clip 1: Strong moment",
      "hook": "A concise hook.",
      "summary": "Why this moment works.",
      "duration_bucket": "30s",
      "start_seconds": 12,
      "end_seconds": 42,
      "duration_seconds": 30,
      "score": 92,
      "rationale": "Why this should work as a reel.",
      "segment_ids": ["seg-1"],
      "captions": ["Caption option"],
      "suggested_platforms": ["social"],
      "safety_notes": null
    }
  ],
  "modelNotes": "Optional model note.",
  "usage": null,
  "providerResponseId": null,
  "model": "mock",
  "mock": true,
  "entitlement": {
    "status": "active",
    "plan": "studio",
    "remainingSeconds": null
  }
}
```

## Candidate Duration Buckets

Returned candidates always use concrete buckets:

- `15s`
- `30s`
- `60s`
- `90s`
- `5-10m`

Returned candidates never use `mixed`.

## Mock And Live Mode

Environment variables:

```text
OPENAI_API_KEY=
SOCIAL_REELS_OPENAI_MODE=mock
```

Rules:

- Missing `SOCIAL_REELS_OPENAI_MODE` defaults to `mock`.
- `SOCIAL_REELS_OPENAI_MODE=mock` never calls OpenAI, even when `OPENAI_API_KEY` exists.
- `SOCIAL_REELS_OPENAI_MODE=live` requires `OPENAI_API_KEY`.
- If live mode is requested but the API key is missing, the endpoint returns a safe server error.

## Timing Notes

OpenAI rough times are hints only. The macOS app owns word-aligned timing and frame snapping.

The backend should not be treated as the final authority for exact edit boundaries.

## Privacy Rules

Do not log or send:

- raw local file paths
- raw FCPXML
- tokens
- secrets
- private provider keys
- unnecessary user identifiers

Normal server logs must not include raw full request bodies. Transcript segment text may be sent to OpenAI only in explicit live mode.

