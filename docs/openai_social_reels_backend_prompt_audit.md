# OpenAI Social Reels Backend Prompt Audit

Audit date: 2026-05-10

Repo audited: `/Users/jamisonerwin/GitHub/cutswitch-site`

Scope: website/backend only. No OpenAI call was made. No code was changed.

Privacy note: this report intentionally avoids API keys, bearer tokens, auth headers, env values, raw user transcript text, private media paths, cache paths, production secrets, and real project payloads. Dynamic transcript data is represented with placeholders.

## 1. Executive Summary

- **Prompt found:** Yes.
- **OpenAI used for Social Reels / moment discovery:** Yes, but only in website/backend live mode.
- **Call site:** `app/api/social-reels/discover/route.ts` delegates to `discoverSocialReelsCandidates(...)` in `lib/openaiSocialReels.ts`.
- **Prompt builder:** `lib/socialReelsOpenAIPrompt.ts`.
- **API endpoint:** OpenAI Responses API via `https://api.openai.com/v1/responses`.
- **Default model:** `gpt-5-mini`.
- **Default mode:** Mock unless `SOCIAL_REELS_OPENAI_MODE=live`.
- **Structured output:** Yes. Live mode uses strict JSON schema from `openAISocialReelsShortlistResponseFormat(...)` in `lib/socialReelsShortlist.ts`.
- **Transcript sent to OpenAI:** In live shortlist mode, the backend sends selected `duration_windows` with bounded transcript excerpts and timing metadata, not all full transcript segments and not word-aligned JSON.
- **Ready / Needs Review / Rejected:** No backend output status field found. Backend returns candidates and filters duration-invalid candidates; Ready/Review/Rejected appears to be app-side or unresolved.
- **macOS app prompt update needed too?** Likely yes for app-side validation/copy/ranking gates if the app has local Ready/Review/Rejected or overlay logic. The website/backend owns the OpenAI discovery prompt found here.

## 2. Call Site Files / Functions

### Product route

- **File:** `app/api/social-reels/discover/route.ts`
- **Function:** `POST(req: Request)`
- **Runtime:** `nodejs`
- **Max duration:** `180`
- **Behavior:**
  - Authenticates with `getUserFromBearerToken(req)`.
  - Applies IP and user rate limits with `enforceRateLimit(...)`.
  - Reads bounded JSON with `readJsonBody(req, MAX_BODY_BYTES)`.
  - Validates with `socialReelsRequestSchema.safeParse(...)`.
  - Checks subscription/trial entitlement.
  - Calls `discoverSocialReelsCandidates(parsed.data)`.
  - Returns no-store JSON with candidates, safe diagnostics, provider/model metadata, and duration-window/filter counts.

### OpenAI service

- **File:** `lib/openaiSocialReels.ts`
- **Function:** `discoverSocialReelsCandidates(input, options)`
- **Endpoint:** `https://api.openai.com/v1/responses`
- **API style:** OpenAI Responses API.
- **Live/mock switch:** `getSocialReelsOpenAIMode()` reads `SOCIAL_REELS_OPENAI_MODE`; default is mock.
- **Server-only:** File imports `server-only`.
- **OpenAI key:** Reads `OPENAI_API_KEY` server-side only.
- **Active path:** Live path is active only when mode is `live`; otherwise mock response is generated locally.

### Prompt builder

- **File:** `lib/socialReelsOpenAIPrompt.ts`
- **Function:** `buildSocialReelsOpenAIPromptInput(input, metadata)`
- **Output:** Responses API `input` array with one `system` message and one JSON-stringified `user` message.

### Response schema

- **Live shortlist file:** `lib/socialReelsShortlist.ts`
- **Function:** `openAISocialReelsShortlistResponseFormat(candidateCount)`
- **Schema type:** Strict Structured Outputs JSON schema.
- **Candidate count:** Min `3`, max effective live shortlist count, capped at `10`.

### Diagnostic/probe scripts, not production behavior

- **File:** `scripts/openAIProbeLadder.ts`
- **Function:** `runOpenAIProbeLadder()`
- **Behavior:** Gated live diagnostic only. Requires `TEST_OPENAI_PROBE=1`.

## 3. Model / API Request Settings

The live OpenAI request body is built in `lib/openaiSocialReels.ts`:

```json
{
  "model": "{{SOCIAL_REELS_OPENAI_MODEL_OR_gpt-5-mini}}",
  "input": "{{PROMPT_INPUT_ARRAY}}",
  "max_output_tokens": 6000,
  "text": {
    "format": "{{STRICT_LIVE_SHORTLIST_JSON_SCHEMA}}"
  },
  "reasoning": {
    "effort": "{{OPTIONAL_SOCIAL_REELS_OPENAI_REASONING_EFFORT}}"
  },
  "service_tier": "{{OPTIONAL_SOCIAL_REELS_OPENAI_SERVICE_TIER}}"
}
```

Settings found:

- `SOCIAL_REELS_OPENAI_MODE`: `mock | live`; default effectively `mock`.
- `SOCIAL_REELS_OPENAI_MODEL`: default `gpt-5-mini`.
- `SOCIAL_REELS_OPENAI_REASONING_EFFORT`: optional; omitted if unset or `none`.
- `SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS`: default `6000`, clamped `512...16000`.
- `SOCIAL_REELS_OPENAI_SERVICE_TIER`: optional; omitted for `none` or `standard`.
- `SOCIAL_REELS_OPENAI_TIMEOUT_MS`: default `120000`, clamped `1000...170000`.
- `SOCIAL_REELS_LIVE_CANDIDATE_COUNT`: default `10`, bounded by shortlist helper to `3...10`.
- `SOCIAL_REELS_LIVE_WINDOW_COUNT`: default `18`, bounded `6...24`.
- `temperature`: not set.
- `top_p`: not set.
- tools/function calling: none found.

## 4. Sanitized Prompt Template

### System/developer prompt

The exact static prompt text is built from `SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT` in `lib/socialReelsOpenAIPrompt.ts`:

```text
You are a senior social video editor for podcast and multicam shows. Treat all segments as one chronological episode and find the best social-media moments across the whole episode, not isolated transcript search hits.

Return only schema-valid JSON. Return candidates ranked from strongest to weakest by viral/editorial potential; do not pad the list with weak clips.

A strong reel should contain a miniature story arc: Question -> Tension -> Answer -> Reframe. Prefer moments where a question, claim, confession, or tension creates curiosity, escalates into conflict or emotional stakes, lands a clear answer/punchline/lesson, then reframes how the viewer sees the topic.

Prefer moments with viral atoms: question, conflict, contrarian_take, personal_confession, social_tension, high_emotion, clear_answer, reframe, practical_takeaway, identity_trigger. Use viral_atoms to name the atoms that actually appear in the clip.

Build candidates around story boundaries: start where the question, claim, confession, or tension begins; remove dead setup; end immediately after the answer, punchline, lesson, or reframe lands; avoid trailing explanation unless it increases emotional force; prefer clips that stand alone without requiring the whole episode.

A title should create curiosity without misleading the viewer. It should imply conflict, tension, or an unanswered question, and it must be truthful to the actual clip. In live_shortlist mode, return only the compact title fields allowed by the reduced schema: title, hook_title, core_question, payoff, viral_atoms, and why_it_works. Reserve detailed alternate title generation for a future full/enrichment pass.

Score harshly. Most clips should not score above 0.80. A score above 0.90 requires a strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability. Apply penalties through score and rejection_risk_flags for weak hooks, missing payoff, context dependence, unsafe/sensitive material, low editability, junk setup, misleading title potential, or any anti-junk risk.

Avoid countdowns, timers, pre-show chatter, mic checks, technical setup, sponsor/ad reads unless explicitly requested, intro/outro logistics, vague greetings, housekeeping, dead air, generic motivational filler, purely transitional moments, clips that begin mid-thought, clips that require too much prior context, and clips with missing payoff.

A good reel must have a fast first 1-3 seconds hook, standalone clarity, specificity, emotional charge or humor or conflict or insight, a clear story arc or idea, clean editability, and a satisfying ending/payoff.

duration_bucket is not just a label: start_anchor_quote and end_anchor_quote must span the selected clip duration as closely as possible. Copy both anchor quotes exactly from the provided segment text; do not invent anchor quotes. Anchor quotes must be distinctive and present in the transcript.

Duration bucket is a hard constraint. 15s clips must be about 10-22 seconds, 30s clips about 22-42 seconds, 60s clips about 45-78 seconds, 90s clips about 70-115 seconds, and 5-10m clips about 240-660 seconds. Do not return a candidate for a bucket if the available transcript span cannot support that duration.

When duration_windows are provided, use them as the duration source of truth. Choose one duration-valid window per candidate, keep start_seconds/end_seconds/duration_seconds inside that window, and place start/end anchor quotes near the provided boundary hints. For a 60s request, select a real 45-78 second story span; do not compress a small highlight into a fake 60s clip. A 60s clip is not a 10-second highlight.

Use duration window quality metadata as a guide, not as a replacement for editorial judgment. Prefer windows with standalone Question -> Tension -> Answer -> Reframe shape, clear tension, confession, practical lesson, emotional turn, reframe, payoff, or a specific claim. Avoid windows marked as intro_setup, outro_logistics, podcast_wrapup, product_promo, sponsor_or_ad, book_link_outro, follow_up_logistics, meta_editing, audio_check, camera_check, mic checks, technical setup, pre-show chatter, dead air, tasting/product ingredient discussion, or filler unless the requested style explicitly requires that material.

Set context_dependency accurately: low means the clip stands alone, medium means mild context helps, high means the clip probably needs prior episode context and should usually be skipped. Use core_question and payoff compactly so the app can rank candidates without a second heavy enrichment pass.

Use sensitivity_level precisely. Sexual wellness, emotional vulnerability, grief, intimacy, or adult-but-appropriate discussion should be sensitive_topic, not automatically unsafe. Use unsafe_or_policy_risk only for genuinely risky, platform-safety, medical/legal, explicit, hateful, harassing, exploitative, or otherwise policy-risk content. Prefer rejection_risk_flags sensitive_topic over the older broad unsafe_or_sensitive label.

If you cannot find enough duration-valid candidates, return fewer candidates rather than padding with compact quotes or weak starts. CutSwitch will filter candidates outside the duration range.

rough_start_seconds/start_seconds and rough_end_seconds/end_seconds are hints only, not final timing claims. CutSwitch will validate timing locally and reject weak clips or candidates outside their requested bucket. The macOS app owns word-aligned timing and frame snapping. Do not include raw file paths, private metadata, or invented timestamps.
```

### User/input prompt template

The second Responses API input item is a JSON string. In live shortlist mode it uses this shape:

```json
{
  "source_duration_seconds": "{{SOURCE_DURATION_SECONDS}}",
  "duration_bucket": "{{DURATION_BUCKET}}",
  "duration_preferences": "{{DURATION_PREFERENCES}}",
  "requested_candidate_count": "{{EFFECTIVE_CANDIDATE_COUNT_FOR_MODEL}}",
  "original_requested_candidate_count": "{{ORIGINAL_APP_REQUESTED_COUNT}}",
  "effective_candidate_count": "{{EFFECTIVE_CANDIDATE_COUNT_FOR_MODEL}}",
  "discovery_mode": "live_shortlist",
  "live_shortlist_note": "{{LIVE_SHORTLIST_GUIDANCE}}",
  "duration_window_instruction": "{{DURATION_WINDOW_GUIDANCE}}",
  "duration_windows": "{{SELECTED_DURATION_WINDOWS}}",
  "source_segments_sent": "duration_windows_only",
  "source_segment_count": "{{SOURCE_SEGMENT_COUNT}}",
  "custom_duration_seconds": "{{CUSTOM_DURATION_OR_NULL}}",
  "style": "{{STYLE}}",
  "layout": "{{LAYOUT}}",
  "caption_style": "{{CAPTION_STYLE}}",
  "episode_metadata": "{{EPISODE_METADATA}}",
  "context": "{{CONTEXT}}",
  "segments": []
}
```

The live prompt explicitly tells the model to choose from `duration_windows` and not scan/invent from a full transcript blob.

## 5. Input Payload Shape

### Incoming backend request

`socialReelsRequestSchema` accepts and normalizes this sanitized shape:

```json
{
  "project_hash": "{{PRIVACY_SAFE_PROJECT_HASH}}",
  "project_fingerprint": "{{OPTIONAL_PRIVACY_SAFE_PROJECT_FINGERPRINT}}",
  "source_duration_seconds": 3600,
  "duration_preferences": ["60s"],
  "duration_bucket": "60s",
  "requested_candidate_count": 30,
  "candidate_count": 30,
  "custom_duration_seconds": {
    "min": 45,
    "max": 78
  },
  "style": "balanced",
  "layout": "vertical",
  "caption_style": "bold",
  "episode_metadata": {
    "title": "{{EPISODE_TITLE}}",
    "show_name": "{{SHOW_NAME}}",
    "episode_number": "{{EPISODE_NUMBER}}",
    "published_at": "{{PUBLISHED_AT}}",
    "guest_names": ["{{GUEST_NAME}}"]
  },
  "segments": [
    {
      "segment_id": "{{SEGMENT_ID}}",
      "start_seconds": 0,
      "end_seconds": 90,
      "speaker": "{{SPEAKER_LABEL}}",
      "text": "{{CLEANED_TRANSCRIPT_SEGMENT_TEXT}}"
    }
  ],
  "context": {
    "platform": "social",
    "show_name": "{{SHOW_NAME}}",
    "content_notes": "{{OPTIONAL_CONTENT_NOTES}}"
  }
}
```

### Duration window payload sent to OpenAI

Live mode constructs backend-generated duration windows. OpenAI sees selected windows like:

```json
{
  "window_id": "{{WINDOW_ID}}",
  "segment_id": "{{SEGMENT_ID}}",
  "duration_bucket": "60s",
  "start_seconds": 120,
  "end_seconds": 180,
  "duration_seconds": 60,
  "start_anchor_hint": "{{SHORT_EXACT_BOUNDARY_HINT}}",
  "end_anchor_hint": "{{SHORT_EXACT_BOUNDARY_HINT}}",
  "window_quality_score": 0.91,
  "window_quality_reasons": ["question", "tension", "payoff"],
  "window_demotion_reasons": [],
  "window_exclusion_reason": null,
  "speaker": "{{SPEAKER_LABEL}}",
  "text_excerpt": "{{BOUNDED_TRANSCRIPT_WINDOW_EXCERPT}}"
}
```

### Transcript format summary

- Full transcript text sent? **No, not in live shortlist mode.** The model receives bounded selected window excerpts.
- Word-aligned JSON sent? **No.** Backend prompt uses segment/window seconds and anchor hints. Prompt says the macOS app owns word-aligned timing and frame snapping.
- Speaker labels sent? **Yes, when present on selected windows.**
- Timestamps sent? **Yes:** window start/end/duration seconds.
- Cleaned transcript sent? **Yes, as bounded `text_excerpt` and anchor hints derived from segments.**

## 6. Output Schema

### Live shortlist schema

The live OpenAI response format is strict JSON schema:

```json
{
  "type": "json_schema",
  "name": "social_reels_live_shortlist",
  "strict": true,
  "schema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["candidates", "model_notes"],
    "properties": {
      "candidates": {
        "type": "array",
        "minItems": 3,
        "maxItems": "{{EFFECTIVE_CANDIDATE_COUNT_MAX_10}}",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "candidate_id",
            "title",
            "hook_title",
            "summary",
            "duration_bucket",
            "segment_id",
            "start_seconds",
            "end_seconds",
            "duration_seconds",
            "start_anchor_quote",
            "end_anchor_quote",
            "clip_type",
            "topic_tag",
            "why_it_works",
            "viral_atoms",
            "core_question",
            "payoff",
            "context_dependency",
            "sensitivity_level",
            "rejection_risk_flags",
            "score",
            "scores"
          ]
        }
      },
      "model_notes": {
        "anyOf": [
          { "type": "string", "maxLength": 1000 },
          { "type": "null" }
        ]
      }
    }
  }
}
```

Candidate fields:

```json
{
  "candidate_id": "{{WINDOW_ID_OR_DERIVATIVE}}",
  "title": "{{TITLE}}",
  "hook_title": "{{HOOK_TITLE}}",
  "summary": "{{SUMMARY}}",
  "duration_bucket": "60s",
  "segment_id": "{{SEGMENT_ID}}",
  "start_seconds": 120,
  "end_seconds": 180,
  "duration_seconds": 60,
  "start_anchor_quote": "{{EXACT_QUOTE_FROM_WINDOW}}",
  "end_anchor_quote": "{{EXACT_QUOTE_FROM_WINDOW}}",
  "clip_type": "story_beat",
  "topic_tag": "{{TOPIC}}",
  "why_it_works": "{{REASON}}",
  "viral_atoms": ["question", "clear_answer", "reframe"],
  "core_question": "{{QUESTION_OR_NULL}}",
  "payoff": "{{PAYOFF_OR_NULL}}",
  "context_dependency": "low",
  "sensitivity_level": "none",
  "rejection_risk_flags": [],
  "score": 0.82,
  "scores": {
    "hook_strength": 0.82,
    "standalone_clarity": 0.8,
    "payoff_strength": 0.81,
    "emotional_charge": 0.7,
    "novelty": 0.72,
    "editability": 0.85,
    "shareability": 0.8,
    "context_independence": 0.79,
    "overall": 0.82
  }
}
```

### Backend hydration

After OpenAI returns the reduced live shortlist schema, `hydrateSocialReelsShortlistResponse(...)` filters out duration-invalid candidates and hydrates each remaining candidate into the fuller app-compatible `socialReelsCandidateSchema` shape.

The fuller hydrated shape may add fields such as `hook`, `subtitle_intro`, `social_caption`, `conflict`, `title_options`, `title_score`, `edit_feasibility_score`, `risk_penalty`, `rationale`, `segment_ids`, `captions`, `suggested_platforms`, and `safety_notes`. These are not requested from OpenAI in live shortlist mode.

## 7. Scoring / Rubric

Model-side rubric found in the prompt:

- Rank strongest to weakest by viral/editorial potential.
- Do not pad weak clips.
- Prefer `Question -> Tension -> Answer -> Reframe`.
- Prefer viral atoms: `question`, `conflict`, `contrarian_take`, `personal_confession`, `social_tension`, `high_emotion`, `clear_answer`, `reframe`, `practical_takeaway`, `identity_trigger`.
- Strong candidates need fast hook, standalone clarity, specificity, emotional charge/humor/conflict/insight, clean editability, and satisfying ending/payoff.
- Score harshly.
- Most clips should not score above `0.80`.
- Scores above `0.90` require strong hook, tension/conflict, payoff, standalone clarity, title potential, and clean editability.
- Penalties should be represented through `score` and `rejection_risk_flags`.
- Sensitivity taxonomy distinguishes `sensitive_topic` from `unsafe_or_policy_risk`.

Backend-side deterministic filtering:

- Live candidates are rejected if the rough duration does not fit the requested bucket.
- Current live ranges:
  - `15s`: `10...22`
  - `30s`: `22...42`
  - `60s`: `45...78`
  - `90s`: `70...115`
  - `5-10m`: `240...660`

Ready / Needs Review / Rejected:

- No backend schema field named `ready`, `needs_review`, or `rejected` was found for Social Reels candidates.
- The backend does produce rejection risk flags and filters duration-invalid candidates.
- Ready/Review/Rejected appears to be app-side or absent from this backend prompt contract.

## 8. Boundary Rules

Boundary instructions found:

- Start where the question, claim, confession, or tension begins.
- Remove dead setup.
- End immediately after the answer, punchline, lesson, or reframe lands.
- Avoid trailing explanation unless it increases emotional force.
- Avoid clips that begin mid-thought.
- Avoid clips with missing payoff.
- Use exact anchor quotes copied from transcript text.
- Use provided duration windows as source-of-truth spans.
- Keep `start_seconds`, `end_seconds`, and `duration_seconds` inside the selected window.
- Treat OpenAI rough timing as hints only.
- The macOS app owns word-aligned timing and frame snapping.

Mid-word cuts:

- The backend prompt does not ask OpenAI to cut at word/frame precision. Instead, it explicitly delegates word-aligned timing and frame snapping to the macOS app.

Coherent endings:

- Yes. The prompt repeatedly asks for payoff, satisfying ending, and ending after the point lands.

## 9. Emoji / Keyword Behavior

- No backend prompt instruction asks OpenAI to produce emoji.
- No backend prompt instruction asks OpenAI to produce keyword highlights.
- No Social Reels response schema field for emoji or highlighted keywords was found in the backend prompt path.
- If the product needs emoji/keyword overlay behavior, it should likely remain deterministic/app-side or be added as an explicit schema/prompt slice later.

## 10. Privacy Risks

1. **Transcript excerpts are sent to OpenAI in live mode.** The payload is reduced to selected windows, but `text_excerpt`, `start_anchor_hint`, and `end_anchor_hint` can still contain sensitive speech.
2. **Speaker labels are sent when available.** If the app sends real speaker names, selected window payloads can include them.
3. **Episode metadata and content notes are sent.** The prompt includes `episode_metadata` and `context`.
4. **No PII/entity redaction layer found.** The backend minimizes payload size but does not appear to redact names/entities from selected excerpts.
5. **Debug packet files may contain private transcript excerpts.** The renderer intentionally writes prompt/window context to local files for inspection. Those files should not be committed or shared publicly.

Controls already present:

- `project_hash` / `project_fingerprint` reject raw local paths and `.fcpxml`-like values.
- Live mode sends bounded duration-window excerpts instead of all full segments.
- The prompt tells the model not to include raw file paths or private metadata.
- Route diagnostics log counts, timings, issue paths/codes, and safe output shape summaries, not raw transcript text.

## 11. Recommendations

1. **Keep backend as the prompt owner.** The website/backend has the clearest OpenAI prompt and schema contract. The macOS app should call the backend, not OpenAI directly.
2. **Audit macOS Ready/Review/Rejected gates next.** The backend does not define those statuses; app-side validation likely determines them.
3. **Add `prompt_version` / `schema_version` metadata.** This will make prompt comparisons and candidate-quality debugging easier.
4. **Decide whether to explicitly set generation controls.** `temperature` and `top_p` are omitted. If quality varies, add env-controlled settings or document why defaults are preferred.
5. **Add optional transcript redaction/anonymization.** Consider anonymizing speaker labels or sensitive entities before sending selected excerpts to OpenAI, especially for private podcasts.
6. **Clarify emoji/keyword ownership.** Since backend does not ask for emoji/keyword highlights, keep those app-side or add a separate schema extension later.
7. **Document score conversion.** Backend scores are normalized `0...1`; if the app displays `0...100`, document conversion and thresholds.
8. **Do not loosen boundary validation.** Current split is sound: model proposes duration-valid windows and exact anchors; the app owns word/frame timing.

## 12. Whether macOS App Prompt Must Be Updated Too

Backend prompt changes alone affect live Social Reels discovery only if the macOS app is calling `/api/social-reels/discover` and using backend candidates.

The app likely needs separate updates if any of these are true:

- It maps backend scores to Ready/Review/Rejected labels.
- It performs anchor matching and duration tolerance validation.
- It generates emoji, keyword highlights, title overlays, or captions deterministically.
- It has fallback/local mock candidates that should match backend quality standards.
- It has user-facing copy that says OpenAI timing is exact rather than advisory.

Next app-side audit should inspect `SocialReelsModels.swift`, `SocialReelsGenerationSheet.swift`, request packaging services, app validation gates, and any local candidate scoring/ranking code.

## 13. Commands Run

```sh
git status --short
```

Result: PASS. Existing unrelated dirty files were present before this report: `.gitignore`, `Archive.zip`, `components/.DS_Store`, and an earlier untracked audit doc.

```sh
rg -n --glob '!**/.env*' --glob '!**/.next/**' --glob '!**/node_modules/**' --glob '!**/*.xcuserstate' "OpenAI|openai|responses\.create|chat\.completions|api\.openai\.com|OPENAI_API_KEY|moment discovery|social reels|transcript|score|scoring|rubric|candidate|rejected|needs review|ready|structured output|response_format|schema|function calling|prompt|system|developer|instructions" app pages src server backend functions routes lib services workers jobs package.json vercel.json scripts docs
```

Result: PASS. Found active backend Social Reels prompt/call/schema in `app/api/social-reels/discover/route.ts`, `lib/openaiSocialReels.ts`, `lib/socialReelsOpenAIPrompt.ts`, `lib/socialReelsSchema.ts`, and `lib/socialReelsShortlist.ts`.

```sh
git diff --check
```

Result: PASS.
