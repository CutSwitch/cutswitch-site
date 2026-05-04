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

Mock duration targets:

- `15s`: approximately 12 to 18 seconds
- `30s`: approximately 26 to 34 seconds
- `60s`: approximately 54 to 66 seconds
- `90s`: approximately 82 to 98 seconds
- `5-10m`: approximately 300 to 600 seconds when source segment timing supports it

Mock mode estimates token positions inside each segment using `segmentDuration / tokenCount`, then chooses start and end anchor phrases spaced near the target duration. This is still an approximation; the macOS app remains responsible for word-aligned validation and final frame snapping.

For `5-10m` mock candidates, source segments must be long enough to support realistic anchor spacing. Multi-segment long-form mock stitching is deferred until the app/backend contract requires it.

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
      "rejection_risk_flags": [],
      "risk_flags": [],
      "duration_bucket": "30s",
      "start_seconds": 12,
      "end_seconds": 42,
      "duration_seconds": 30,
      "score": 0.92,
      "scores": {
        "hook_strength": 0.92,
        "standalone_clarity": 0.91,
        "payoff_strength": 0.9,
        "emotional_charge": 0.78,
        "novelty": 0.8,
        "editability": 0.88,
        "shareability": 0.9,
        "context_independence": 0.89,
        "overall": 0.92
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
- `rejection_risk_flags` / `risk_flags`: anti-junk flags that identify possible editorial weaknesses.
- `scores`: normalized `0.0` to `1.0` score breakdown for hook strength, standalone clarity, payoff strength, emotional charge, novelty, editability, shareability, context independence, and overall.

Allowed rejection risk flags:

- `countdown_or_timer`
- `pre_show_chatter`
- `mic_check`
- `technical_setup`
- `sponsor_or_ad`
- `intro_outro_logistics`
- `weak_hook`
- `missing_payoff`
- `too_context_dependent`
- `generic_advice`
- `unclear_speaker`
- `unsafe_or_sensitive`
- `low_editability`

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
- In live mode, duration buckets are treated as duration constraints, not labels. Candidates whose anchors do not span their requested bucket may be rejected by the macOS app.

## Live Editorial Rules

The live OpenAI prompt treats all segments as one chronological episode and asks for candidates ranked strongest to weakest by viral/editorial potential.

Candidates should be chosen for:

- strong first 1 to 3 seconds
- standalone clarity
- emotional charge
- story arc or clear idea
- payoff/end beat
- specificity
- shareability
- clean editability
- context independence

Candidates should avoid:

- countdowns and timers
- pre-show chatter
- mic checks
- technical setup
- housekeeping
- sponsor/ad reads unless explicitly requested
- intro/outro logistics
- vague greetings
- clips that begin mid-thought
- clips that require too much prior context
- clips that end before the point lands
- generic motivational filler
- purely transitional moments

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
