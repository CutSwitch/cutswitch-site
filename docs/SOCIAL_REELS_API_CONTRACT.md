# Social Reels API Contract

## Endpoint

`POST /api/social-reels/discover`

Authenticated app-facing endpoint. Requires:

`Authorization: Bearer <supabase_access_token>`

The server derives the user from the bearer token. Clients must not send or rely on `userId`.

## Product Model

The macOS app may show simple packs such as `Best 5`, `Best 10`, `Best 20`, and `Custom`, but the backend returns a larger internal candidate pool so the app can regenerate from cached candidates locally.

Backend candidate pool policy:

- Minimum: `30`
- Default: `50`
- Maximum: `80`
- Mock mode should not return fewer than `30` candidates when enough transcript text exists.

## Request

```json
{
  "project_hash": "privacy-safe-project-hash",
  "source_duration_seconds": 3600,
  "duration_preferences": ["mixed"],
  "requested_candidate_count": 50,
  "custom_duration_seconds": null,
  "style": "balanced",
  "layout": "vertical",
  "caption_style": "bold",
  "episode_metadata": {
    "title": "Episode title",
    "show_name": "Optional show name"
  },
  "segments": [
    {
      "segment_id": "seg-1",
      "start_seconds": 12.4,
      "end_seconds": 93.2,
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

- `project_hash`: required privacy-safe hash. Do not send raw file paths or project titles.
- `source_duration_seconds`: optional source media duration in seconds, max 24 hours. If absent, the backend derives it from segment end times.
- `duration_preferences`: required duration pack list. Allowed values:
  - `15s`
  - `30s`
  - `60s`
  - `90s`
  - `5-10m`
  - `mixed`
  - `custom`
- `requested_candidate_count`: optional. Defaults to `50`. Must be between `30` and `80`.
- `custom_duration_seconds`: required only when `custom` is requested.
- `style`: required editorial style string.
- `layout`: required layout string.
- `caption_style`: required caption style string.
- `episode_metadata`: required safe episode metadata object.
- `segments`: 1 to 2000 transcript segments. Each segment accepts `segment_id`, `start_seconds`, `end_seconds`, `speaker`, and `text`.
- `context`: optional safe metadata only.

## Duration Behavior

Returned candidates always use concrete buckets:

- `15s`
- `30s`
- `60s`
- `90s`
- `5-10m`

Returned candidates never use `mixed` as `duration_bucket`.

If `duration_preferences` includes `mixed`, mock mode returns a balanced spread across the concrete duration buckets. If a request includes only one concrete duration, such as `["60s"]`, candidates may all use that bucket while still respecting the requested pool size.

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
      "title": "Clip 1: story payoff",
      "hook": "A concise hook.",
      "summary": "Why this moment works.",
      "start_anchor_quote": "Exact words copied from the segment text",
      "end_anchor_quote": "A later exact phrase from the segment text",
      "clip_type": "story_beat",
      "topic_tag": "story payoff",
      "hook_title": "Clip 1: story payoff",
      "subtitle_intro": "Exact words copied from the segment text",
      "social_caption": "Exact words copied from the segment text...",
      "why_it_works": "The moment has a clear opening anchor and payoff.",
      "duration_bucket": "30s",
      "start_seconds": 12,
      "end_seconds": 42,
      "duration_seconds": 30,
      "score": 92,
      "scores": {
        "hook_strength": 92,
        "standalone_clarity": 91,
        "payoff_strength": 90,
        "emotional_charge": 78,
        "novelty": 80,
        "editability": 88,
        "overall": 92
      },
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

## Editorial Diversity Fields

Each candidate includes:

- `clip_type`: one of `strong_opinion`, `story_beat`, `emotional_moment`, `funny_moment`, `useful_lesson`, `contrarian_take`, `quote_worthy_line`, `debate_conflict`, `transformation`, `educational_explainer`, or `long_form_highlight`.
- `topic_tag`: short topical label.
- `hook_title`: editor-friendly title.
- `subtitle_intro`: suggested opening caption/subtitle.
- `social_caption`: suggested post caption.
- `why_it_works`: concise editorial rationale.
- `scores`: score breakdown for hook strength, standalone clarity, payoff strength, emotional charge, novelty, editability, and overall.

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
- Mock mode derives anchor quotes from submitted segment text and does not invent anchor quotes.

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
