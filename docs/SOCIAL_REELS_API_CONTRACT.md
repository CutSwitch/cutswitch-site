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

Entitlement and rediscovery policy:

- The first Social Reels discovery is allowed for a valid signed-in account with an active or trialing subscription.
- Social Reels discovery does not consume editing time. Editing time is still consumed only by successful new transcript/diarization creation.
- Normal `Different Moments` regeneration is local in the macOS app and should use the cached full candidate pool. It should not call this backend endpoint.
- Explicit `Find Entirely New Moments` may call this endpoint and is rate-limited.
- Failed OpenAI/provider calls do not consume editing time.
- Exports consume `0` editing time and do not use this endpoint.

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
      "viral_atoms": ["question", "clear_answer", "practical_takeaway"],
      "core_question": "What question or claim makes this clip worth watching?",
      "conflict": "The tension, disagreement, confession, or emotional stakes in the clip.",
      "payoff": "The answer, punchline, lesson, or reframe that lands before the cut.",
      "title_options": [
        {
          "title": "A truthful curiosity title",
          "score": 0.84
        }
      ],
      "title_score": 0.84,
      "edit_feasibility_score": 0.88,
      "risk_penalty": 0,
      "rejection_risk_flags": [],
      "risk_flags": [],
      "duration_bucket": "30s",
      "start_seconds": 12,
      "end_seconds": 42,
      "duration_seconds": 30,
      "score": 0.88,
      "scores": {
        "hook_strength": 0.88,
        "standalone_clarity": 0.87,
        "payoff_strength": 0.86,
        "emotional_charge": 0.78,
        "novelty": 0.8,
        "editability": 0.88,
        "shareability": 0.86,
        "context_independence": 0.85,
        "overall": 0.88
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
- `viral_atoms`: optional list of the viral atoms present in the clip.
- `core_question`: optional question, claim, confession, or tension that opens the miniature story.
- `conflict`: optional tension, disagreement, confession, social friction, or emotional stakes.
- `payoff`: optional answer, punchline, lesson, or reframe that makes the clip satisfying.
- `title_options`: optional scored title ideas, each with `title` and normalized `score`.
- `title_score`: optional normalized score for the strongest truthful title potential.
- `edit_feasibility_score`: optional normalized score for clean editability.
- `risk_penalty`: optional normalized penalty applied for weak hook, missing payoff, context dependence, low editability, misleading title risk, or anti-junk flags.
- `rejection_risk_flags` / `risk_flags`: anti-junk flags that identify possible editorial weaknesses.
- `scores`: normalized `0.0` to `1.0` score breakdown for hook strength, standalone clarity, payoff strength, emotional charge, novelty, editability, shareability, context independence, and overall.

Allowed viral atoms:

- `question`
- `conflict`
- `contrarian_take`
- `personal_confession`
- `social_tension`
- `high_emotion`
- `clear_answer`
- `reframe`
- `practical_takeaway`
- `identity_trigger`

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
SOCIAL_REELS_OPENAI_MODEL=gpt-5-mini
SOCIAL_REELS_OPENAI_REASONING_EFFORT=minimal
SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS=6000
SOCIAL_REELS_OPENAI_SERVICE_TIER=standard
SOCIAL_REELS_OPENAI_TIMEOUT_MS=120000
SOCIAL_REELS_OPENAI_PROBE_TIMEOUT_MS=30000
```

Rules:

- Missing `SOCIAL_REELS_OPENAI_MODE` defaults to `mock`.
- `SOCIAL_REELS_OPENAI_MODE=mock` never calls OpenAI, even when `OPENAI_API_KEY` exists.
- `SOCIAL_REELS_OPENAI_MODE=live` requires `OPENAI_API_KEY`.
- `SOCIAL_REELS_OPENAI_MODEL` controls the production live model when the route is in live mode. The probe ladder uses its own model sequence unless the code is edited intentionally for a focused model-only check.
- `SOCIAL_REELS_OPENAI_REASONING_EFFORT` defaults to a fast diagnostic value in probe mode. If set to `none`, the backend omits `reasoning`. Unsupported model/effort combinations should fail visibly with a safe non-2xx diagnostic rather than silently changing production behavior.
- `SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS` bounds live output. The default is `6000`.
- `SOCIAL_REELS_OPENAI_SERVICE_TIER` defaults to `standard`, which means no priority tier is requested. Set it only for an intentional provider-tier test.
- If live mode is requested but the API key is missing, the endpoint returns a safe server error.
- `SOCIAL_REELS_OPENAI_TIMEOUT_MS` controls the backend OpenAI fetch timeout. It defaults to `120000` milliseconds and is bounded so the route can fail before the platform function limit.
- Mock mode derives anchor quotes from submitted segment text and does not invent anchor quotes.
- In live mode, duration buckets are treated as duration constraints, not labels. Candidates whose anchors do not span their requested bucket may be rejected by the macOS app.

## Timeout Diagnostics

The route returns and logs privacy-safe timing diagnostics. These diagnostics are safe to copy into debugging notes because they do not include transcript text, local paths, tokens, OpenAI keys, raw request bodies, or raw provider responses.

Captured fields:

- `request_id`
- `mode`: `mock` or `live`
- `request_received_at`
- `payload_parse_ms`
- `schema_validation_ms`
- `segment_count`
- `approximate_total_text_chars`
- `requested_candidate_count`
- `duration_preferences`
- `openai_request_started_at`
- `openai_elapsed_ms`
- `response_parse_ms`
- `total_elapsed_ms`
- `timeout_stage`
- `provider`
- `model`

Possible timeout/failure stages:

- `app_unknown`: the app timed out before backend diagnostics were available.
- `route_before_openai`: the route failed before a provider request was started.
- `openai_fetch_timeout`: the backend aborted the OpenAI fetch after `SOCIAL_REELS_OPENAI_TIMEOUT_MS`.
- `openai_non2xx`: OpenAI returned a non-2xx response.
- `openai_invalid_response`: OpenAI returned a response that did not parse or validate against the schema.
- `route_timeout`: the platform route timed out.
- `unknown`: unexpected failure.

Timeout response shape:

```json
{
  "error": "Social reels discovery timed out",
  "stage": "openai_fetch_timeout",
  "request_id": "uuid",
  "elapsed_ms": 120000
}
```

Successful responses include a `diagnostics` object with the same safe timing fields.

## Live Canary Smokes

Normal backend tests do not make live OpenAI calls.

Tiny live canary:

```sh
TEST_SOCIAL_REELS_LIVE=1 npm run test:backend
```

This sends a small synthetic three-segment request with `requested_candidate_count = 30` and `duration_preferences = ["60s"]`. It expects the target environment to have `SOCIAL_REELS_OPENAI_MODE=live` and `OPENAI_API_KEY` configured. The canary uses synthetic transcript text only.

Large app-shaped mock/prod smoke:

```sh
TEST_SOCIAL_REELS=1 npm run test:backend
```

Use this for the larger synthetic app-shaped payload. It is gated separately so routine backend tests do not call Social Reels discovery.

## OpenAI Probe Ladder

Normal tests do not call OpenAI. To diagnose provider/model/schema latency without sending private transcript data, run the direct OpenAI probe ladder:

```sh
TEST_OPENAI_PROBE=1 npm run test:backend
```

The probe ladder calls the OpenAI Responses API directly from the backend test script with synthetic safe text only. It does not call `/api/social-reels/discover`, does not use app/user transcript payloads, and stops after the first failing probe.

Probe order:

1. `gpt-5-mini`: minimal ping, tiny input, no structured output, `max_output_tokens = 32`.
2. `gpt-5-mini`: minimal structured output with a tiny strict JSON schema.
3. `gpt-5-mini`: reduced Social Reels schema, 3 candidates.
4. `gpt-5-mini`: reduced Social Reels schema, 10 candidates.
5. `gpt-5-mini`: reduced Social Reels schema, 30 candidates.
6. `gpt-5.4-mini`: reduced Social Reels schema, 30 candidates.
7. `gpt-5.4`: reduced Social Reels schema, 10 candidates.
8. `gpt-5.4`: full Social Reels schema, 10 candidates.
9. `gpt-5.4`: full Social Reels schema, 30 candidates.

Each probe prints only privacy-safe metadata:

- `probe_name`
- `request_id`
- `model`
- `reasoning_effort`
- `service_tier`
- `max_output_tokens`
- `candidate_count_requested`
- `schema_mode`: `none`, `tiny`, `reduced_social`, or `full_social`
- `elapsed_ms`
- `status`
- `openai_status_code`
- `timeout_stage`
- `output_present`
- `output_text_length`
- `candidate_count`
- `parse_valid`
- `incomplete_reason`
- provider response id/model when available
- safe error type

Do not run `TEST_OPENAI_PROBE=1` repeatedly. Use one ladder run to find the first failing stage, then change one variable at a time, such as `SOCIAL_REELS_OPENAI_REASONING_EFFORT`, `SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS`, or `SOCIAL_REELS_OPENAI_SERVICE_TIER`.

## Live Editorial Rules

The live OpenAI prompt treats all segments as one chronological episode and asks for candidates ranked strongest to weakest by viral/editorial potential.

A strong reel should contain a miniature story arc:

`Question -> Tension -> Answer -> Reframe`

OpenAI should prefer moments with visible viral atoms:

- question
- conflict
- contrarian_take
- personal_confession
- social_tension
- high_emotion
- clear_answer
- reframe
- practical_takeaway
- identity_trigger

OpenAI should build candidates around story boundaries:

1. Start where the question, claim, confession, or tension begins.
2. Remove dead setup.
3. End immediately after the answer, punchline, lesson, or reframe lands.
4. Avoid trailing explanation unless it increases emotional force.
5. Prefer clips that stand alone without requiring the whole episode.

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
- title potential

Titles should create curiosity without misleading the viewer. They should imply conflict, tension, or an unanswered question while staying truthful to the actual clip.

Scoring should be harsh:

- Most clips should not score above `0.80`.
- A score above `0.90` requires a strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability.
- Use `risk_penalty` for weak hooks, missing payoff, context dependence, unsafe or sensitive material, low editability, junk setup, or misleading title risk.

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
