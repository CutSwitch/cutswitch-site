# OpenAI Social Reels Prompt Audit

Audit date: 2026-05-10

Requested macOS app repo: `/Users/studiosage/Developer/CutSwitchPodcast`

Accessible repo audited: `/Users/jamisonerwin/GitHub/cutswitch-site`

> Privacy note: this report intentionally excludes API keys, bearer tokens, auth headers, raw user transcript text, raw word-timing JSON, private media paths, cache paths, user emails, and local project paths. Dynamic transcript/request examples use placeholders only.

## 1. Executive Summary

- **OpenAI used?** Yes, in the accessible website/backend repo for Social Reels discovery when `SOCIAL_REELS_OPENAI_MODE=live`.
- **Call location found:** Website/backend route `app/api/social-reels/discover/route.ts` calls `discoverSocialReelsCandidates(...)` in `lib/openaiSocialReels.ts`.
- **Prompt found?** Yes. The exact static system/developer instructions are in `lib/socialReelsOpenAIPrompt.ts` as `SOCIAL_REELS_EDITORIAL_SYSTEM_PROMPT`.
- **Model/settings found?** Yes. The backend uses the OpenAI Responses API endpoint `https://api.openai.com/v1/responses`. Default model is `gpt-5-mini`; default max output tokens are `6000`; default OpenAI timeout is `120000ms`; reasoning effort and service tier are optional env-driven settings.
- **Output schema found?** Yes. Live mode uses a reduced strict Structured Outputs JSON schema from `openAISocialReelsShortlistResponseFormat(...)` in `lib/socialReelsShortlist.ts`. A fuller schema also exists in `lib/socialReelsSchema.ts` but is not currently the live shortlist schema.
- **Website/backend inspection needed?** Already done here because the requested app repo is not mounted in this environment.
- **macOS app confirmation needed?** Yes. The requested app repo path does not exist in this environment, so whether the app has any separate direct OpenAI call remains **[Unresolved]**. The accessible backend strongly suggests the app should call the website/backend endpoint rather than OpenAI directly, but that must be confirmed in the macOS repo.

## 2. Call Sites

### Website/backend Social Reels route

- **File path:** `app/api/social-reels/discover/route.ts`
- **Function/type name:** `POST(req: Request)`
- **Endpoint/API style:** Authenticated Next.js App Router API route.
- **Runtime:** `nodejs`; `maxDuration = 180`.
- **Auth/payload behavior:** Uses `getUserFromBearerToken(req)`, `readJsonBody(req, MAX_BODY_BYTES)`, `socialReelsRequestSchema.safeParse(...)`, and `enforceRateLimit(...)`.
- **Active or dead code:** Active route.
- **OpenAI directly?** No direct OpenAI call in the route. It delegates to `discoverSocialReelsCandidates(...)`.

### OpenAI service implementation

- **File path:** `lib/openaiSocialReels.ts`
- **Function/type name:** `discoverSocialReelsCandidates(input, options)`
- **Endpoint/API style:** OpenAI Responses API via `fetch("https://api.openai.com/v1/responses", ...)`.
- **Active or dead code:** Active when `SOCIAL_REELS_OPENAI_MODE=live`; mock mode is the default otherwise.
- **Model name:** `SOCIAL_REELS_OPENAI_MODEL` env or default `gpt-5-mini`.
- **Settings:**
  - `max_output_tokens`: `SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS`, default `6000`, clamped `512...16000`.
  - `reasoning.effort`: optional `SOCIAL_REELS_OPENAI_REASONING_EFFORT`; omitted when unset or `none`.
  - `service_tier`: optional `SOCIAL_REELS_OPENAI_SERVICE_TIER`; omitted for `none` or `standard`.
  - `timeout`: `SOCIAL_REELS_OPENAI_TIMEOUT_MS`, default `120000ms`, clamped `1000...170000`.
  - `temperature/top_p`: **not set** in the current request body.
  - Tools/functions: **none found**.
- **Structured output:** Uses `text.format = openAISocialReelsShortlistResponseFormat(effectiveCandidateCount)`.
- **Secrets:** Uses `OPENAI_API_KEY` server-side only. The key is sent only in the Authorization header and is not logged by the code inspected.

### Prompt builder

- **File path:** `lib/socialReelsOpenAIPrompt.ts`
- **Function/type name:** `buildSocialReelsOpenAIPromptInput(...)`
- **Endpoint/API style:** Produces Responses API `input` array with `system` and `user` messages.
- **Active or dead code:** Active in the live OpenAI path and reused by debug packet rendering.

### Probe script, not product path

- **File path:** `scripts/openAIProbeLadder.ts`
- **Function/type name:** `runOpenAIProbeLadder()`
- **Endpoint/API style:** Gated live diagnostic script using Responses API.
- **Active or dead code:** Not product behavior. Runs only when `TEST_OPENAI_PROBE=1`.

## 3. Prompt / Instructions

### Static system/developer instructions found

The production system prompt currently resolves to this static instruction text before dynamic data is attached:

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

### Dynamic user/input prompt shape

The user message is JSON. In live shortlist mode, dynamic transcript text is not sent as full segments; selected duration windows are sent instead.

```json
{
  "source_duration_seconds": 3600,
  "duration_bucket": "60s",
  "duration_preferences": ["60s"],
  "requested_candidate_count": 10,
  "original_requested_candidate_count": 30,
  "effective_candidate_count": 10,
  "discovery_mode": "live_shortlist",
  "live_shortlist_note": "{{LIVE_SHORTLIST_INSTRUCTIONS}}",
  "duration_window_instruction": "{{DURATION_WINDOW_INSTRUCTIONS}}",
  "duration_windows": "{{SELECTED_DURATION_WINDOWS}}",
  "source_segments_sent": "duration_windows_only",
  "source_segment_count": 68,
  "custom_duration_seconds": null,
  "style": "{{STYLE}}",
  "layout": "{{LAYOUT}}",
  "caption_style": "{{CAPTION_STYLE}}",
  "episode_metadata": "{{PROJECT_METADATA}}",
  "context": "{{REQUEST_CONTEXT}}",
  "segments": []
}
```

## 4. Input Payload Shape

### Incoming route request

The route accepts an authenticated JSON body validated by `socialReelsRequestSchema`:

```json
{
  "project_hash": "{{PRIVACY_SAFE_PROJECT_HASH}}",
  "project_fingerprint": "{{OPTIONAL_PRIVACY_SAFE_PROJECT_FINGERPRINT}}",
  "source_duration_seconds": 3600,
  "duration_preferences": ["15s", "30s", "60s", "90s", "5-10m", "mixed", "custom"],
  "duration_bucket": "60s",
  "requested_candidate_count": 30,
  "candidate_count": 30,
  "custom_duration_seconds": { "min": 45, "max": 78 },
  "style": "balanced",
  "layout": "vertical",
  "caption_style": "bold",
  "episode_metadata": {
    "title": "{{TITLE}}",
    "show_name": "{{SHOW_NAME}}",
    "episode_number": "{{EPISODE_NUMBER}}",
    "published_at": "{{DATE}}",
    "guest_names": ["{{GUEST}}"]
  },
  "segments": [
    {
      "segment_id": "seg-001",
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

### Transcript format sent to OpenAI in live mode

The live OpenAI prompt uses `duration_windows`, not full word-aligned JSON and not all raw segments. Each prompt window is derived server-side from transcript segments and includes bounded excerpts plus metadata:

```json
{
  "window_id": "window-60s-001",
  "segment_id": "seg-001",
  "speaker": "{{SPEAKER_LABEL}}",
  "duration_bucket": "60s",
  "start_seconds": 120.0,
  "end_seconds": 180.0,
  "duration_seconds": 60,
  "start_anchor_hint": "{{SHORT_EXACT_TEXT_HINT_NEAR_START}}",
  "end_anchor_hint": "{{SHORT_EXACT_TEXT_HINT_NEAR_END}}",
  "window_quality_score": 0.91,
  "window_quality_reasons": ["question", "tension", "payoff"],
  "window_demotion_reasons": [],
  "window_exclusion_reason": null,
  "text_excerpt": "{{BOUNDED_TRANSCRIPT_WINDOW_EXCERPT}}"
}
```

### What is not sent to OpenAI in the live shortlist prompt

- Full word-aligned JSON.
- Local media paths.
- Cache paths.
- Auth tokens.
- Raw file paths.
- The full transcript segment list, when `discovery_mode` is `live_shortlist`.

## 5. Output Schema

### Live shortlist Structured Output schema

The live path uses a strict JSON schema named `social_reels_live_shortlist`. The schema requires top-level:

```json
{
  "candidates": ["{{3_TO_10_CANDIDATES}}"],
  "model_notes": "{{OPTIONAL_NOTES_OR_NULL}}"
}
```

Each live shortlist candidate requires:

```json
{
  "candidate_id": "window-60s-001",
  "title": "{{TITLE}}",
  "hook_title": "{{HOOK_TITLE}}",
  "summary": "{{SUMMARY}}",
  "duration_bucket": "60s",
  "segment_id": "seg-001",
  "start_seconds": 120,
  "end_seconds": 180,
  "duration_seconds": 60,
  "start_anchor_quote": "{{EXACT_QUOTE_FROM_WINDOW_START}}",
  "end_anchor_quote": "{{EXACT_QUOTE_FROM_WINDOW_END}}",
  "clip_type": "story_beat",
  "topic_tag": "{{TOPIC}}",
  "why_it_works": "{{EDITORIAL_REASON}}",
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

Allowed clip types include `strong_opinion`, `story_beat`, `emotional_moment`, `funny_moment`, `useful_lesson`, `contrarian_take`, `quote_worthy_line`, `debate_conflict`, `transformation`, `educational_explainer`, and `long_form_highlight`.

Allowed risk flags include `countdown_or_timer`, `pre_show_chatter`, `mic_check`, `technical_setup`, `sponsor_or_ad`, `intro_outro_logistics`, `weak_hook`, `missing_payoff`, `too_context_dependent`, `generic_advice`, `unclear_speaker`, `sensitive_topic`, `unsafe_or_policy_risk`, `unsafe_or_sensitive`, and `low_editability`.

### Full schema exists but is not the current live shortlist schema

`lib/socialReelsSchema.ts` also defines a fuller response shape with `hook`, `subtitle_intro`, `social_caption`, `conflict`, `title_options`, `title_score`, `edit_feasibility_score`, `risk_penalty`, `rationale`, `segment_ids`, `captions`, `suggested_platforms`, and `safety_notes`. In the inspected code, live shortlist mode asks OpenAI for the reduced schema and hydrates the result into the fuller app-compatible candidate shape after validation.

## 6. Scoring / Rejection Rubric

### Model-side scoring rubric

The prompt tells the model to:

- Rank candidates strongest to weakest.
- Use a miniature story arc: `Question -> Tension -> Answer -> Reframe`.
- Prefer viral atoms: `question`, `conflict`, `contrarian_take`, `personal_confession`, `social_tension`, `high_emotion`, `clear_answer`, `reframe`, `practical_takeaway`, `identity_trigger`.
- Score harshly on normalized `0.0...1.0` values.
- Keep most scores at or below `0.80`.
- Reserve scores above `0.90` for strong hook, clear tension/conflict, satisfying payoff, standalone clarity, title potential, and clean editability.
- Use `score`, `scores`, and `rejection_risk_flags`; live shortlist mode does not ask for `risk_penalty`.

### Ready / Needs Review / Rejected

- **Backend model output:** Does not return a `Ready`, `Needs Review`, or `Rejected` status field.
- **Backend deterministic filter:** Filters live candidates whose duration is outside bucket compliance.
- **App-side gates:** **[Unresolved]** because the macOS app repo is unavailable in this environment. The app likely determines Ready/Review/Rejected from timing validation, anchor matching, score/risk fields, and local word-aligned timing, but this must be confirmed in the app repo.
- **Reasons:** Model returns `why_it_works`, `rejection_risk_flags`, scores, and compact metadata. Deterministic backend duration filtering adds safe filter counts but not app review status.

## 7. Boundary Rules

### Present in prompt

The prompt currently does ask for:

- Clean story boundaries.
- Start where the question, claim, confession, or tension begins.
- Remove dead setup.
- End immediately after answer, punchline, lesson, or reframe lands.
- Avoid trailing explanation unless it increases emotional force.
- Avoid clips that begin mid-thought.
- Avoid missing payoff.
- Use exact anchor quotes copied from transcript text.
- Treat duration buckets as hard constraints.
- Use backend duration windows as source-of-truth span guidance.

### Not fully model-owned

- **Mid-word cuts:** The prompt says the macOS app owns word-aligned timing and frame snapping. It does not rely on the model for exact word/frame cuts.
- **Mid-thought cuts:** The prompt explicitly warns against beginning mid-thought and asks for coherent story boundaries.
- **Coherent endings:** Yes, the prompt asks for satisfying endings/payoffs and ending after the point lands.

## 8. Emoji / Keyword Rules

- **Emoji behavior:** No prompt instruction asking OpenAI to produce emoji was found in the website/backend Social Reels prompt.
- **Keyword highlights:** No prompt instruction asking OpenAI for keyword highlight behavior was found.
- **Current likely behavior:** If emoji/keyword overlays exist, they appear to be app-side or another service-side concern, not part of the inspected website/backend OpenAI request. This remains **[Unresolved]** until the macOS app repo is available.

## 9. Privacy / Safety Risks

### Controls already present

- `project_hash` and `project_fingerprint` are validated to reject raw local paths and `.fcpxml`-like values.
- Live mode sends bounded `duration_windows`, not full segment arrays.
- The prompt explicitly says not to include raw file paths, private metadata, or invented timestamps.
- Route diagnostics log safe counts, issue paths/codes, model/status/timings, and output shape summaries, not raw transcript text.
- Invalid response diagnostics include candidate keys and issue paths/codes, not candidate text values.

### Remaining privacy risks

1. **Transcript excerpts still go to OpenAI.** Live prompt windows include `text_excerpt`, `start_anchor_hint`, and `end_anchor_hint`, which may contain sensitive podcast content. This is expected for discovery but should be disclosed and minimized.
2. **Speaker labels may go to OpenAI.** If user-provided speaker labels contain real names, those names may be included in `duration_windows`.
3. **Episode metadata may go to OpenAI.** `episode_metadata`, `context`, style, layout, and caption preferences are included in the user prompt.
4. **No app repo confirmation.** The app may send additional metadata before reaching the website/backend; this is **[Unresolved]**.
5. **No real-user transcript redaction layer found in backend.** The backend uses quality-scored excerpts but does not appear to perform PII/entity redaction before OpenAI.

## 10. Recommendations

1. **Confirm app call path.** Inspect the macOS app repo for `SocialReelsGenerationRequest`, cloud endpoint URLs, and any direct `api.openai.com` usage. The requested repo was not available here.
2. **Document app-side Ready/Review/Rejected gates.** Backend does not define these statuses. Add an audit of the app timing/anchor validation and review threshold logic.
3. **Make privacy disclosure explicit.** Ensure Privacy Policy/product copy says Social Reels may send transcript excerpts and speaker labels to the backend/OpenAI for candidate discovery.
4. **Consider a transcript minimization pass.** Keep the windowed approach, but evaluate speaker-label anonymization or optional redaction for sensitive shows.
5. **Keep exact timing app-side.** The current split is healthy: OpenAI suggests windows/anchors; the app owns word-aligned timing and frame snapping. Do not move frame-level timing into the model.
6. **Add explicit no-emoji rule only if needed.** If the app wants deterministic title overlays and keyword behavior, keep emoji/keywords app-side and add prompt language telling the model not to output emoji/keyword formatting.
7. **Scoring calibration:** Backend uses normalized `0...1`; if app UI shows `0...100`, document the conversion. Do not ask the model for “near 100”; current prompt correctly discourages inflated scores.
8. **Temperature/top_p:** These are currently omitted. That may be fine for Responses API defaults, but if output variance is causing quality drift, add explicit env-controlled settings or document why defaults are used.
9. **Schema versioning:** Add a `schema_version`/`prompt_version` in response metadata if the app needs to compare candidate quality across prompt changes.
10. **Renderer/audit tool:** Keep using the existing debug packet renderer to inspect exact prompt payloads without live OpenAI calls.

## 11. If Prompt Is Not In This Repo

The requested macOS app repo was not accessible from this environment:

```text
/Users/studiosage/Developer/CutSwitchPodcast
```

The accessible website/backend repo contains the Social Reels OpenAI prompt and live OpenAI call. The likely owning service for moment discovery is therefore:

```text
/Users/jamisonerwin/GitHub/cutswitch-site
```

### Files inspected in website/backend

```text
app/api/social-reels/discover/route.ts
lib/openaiSocialReels.ts
lib/socialReelsOpenAIPrompt.ts
lib/socialReelsSchema.ts
lib/socialReelsShortlist.ts
lib/socialReelsDurationWindows.ts
lib/socialReelsDiagnostics.ts
scripts/openAIProbeLadder.ts
scripts/renderSocialReelsOpenAIDebug.ts
scripts/testSocialReelsPrompt.ts
scripts/testBackend.ts
docs/SOCIAL_REELS_API_CONTRACT.md
docs/API_CONTRACT.md
```

### Smallest next step for app repo

Ask app-side Codex to run this exact audit in the mounted app repo and confirm:

```text
cd /Users/studiosage/Developer/CutSwitchPodcast
rg -n --glob '!**/.env*' 'OpenAI|openai|api.openai.com|SocialReels|social reels|discover|candidate|score|Ready|Needs Review|Rejected|emoji|keyword|wordAlignment|word aligned|transcript|prompt|response_format|structured|gpt' CutSwitchPodcast
```

The app-side audit should answer whether the macOS app calls:

- `/api/social-reels/discover` on the website/backend,
- a different backend/cloud function, or
- OpenAI directly.

## 12. Commands Run

From attempted app repo:

```sh
pwd && git status --short && git remote -v && git branch --show-current
```

Result: **FAIL** because `/Users/studiosage/Developer/CutSwitchPodcast` is not mounted/does not exist in this environment.

Search/location commands:

```sh
ls -la /Users /Users/studiosage /Users/studiosage/Developer
find /Users/jamisonerwin/Developer /Users/jamisonerwin/GitHub -maxdepth 4 -type d \( -name '*CutSwitch*' -o -name '*.xcodeproj' \)
mdfind 'kMDItemFSName == "CutSwitchPodcast" || kMDItemFSName == "CutSwitchPodcast.xcodeproj"'
```

Result: **PASS**, but no `CutSwitchPodcast` app repo was found.

Website/backend commands:

```sh
git status --short
rg -n --glob '!**/.env*' --glob '!**/*.xcuserstate' --glob '!**/node_modules/**' --glob '!**/.next/**' 'OpenAI|openai|Responses|ChatCompletions|chat\.completions|responses\.create|OPENAI_API_KEY|api\.openai\.com|model:|gpt|moment|moments|social reels|Generate Moments|discovery|candidate|score|scoring|rubric|transcript|word aligned|wordAlignment|JSON schema|response_format|structured|function calling|tool|pyannote|Whisper|prompt|system|developer|instructions|user prompt|rejected|needs review|ready' app lib scripts docs package.json
rg -n --glob '!**/.env*' --glob '!**/.next/**' --glob '!**/node_modules/**' 'Ready|Needs Review|Rejected|ready|review|rejected|emoji|keyword|keywords|highlight' app lib scripts docs
sed -n '1,160p' lib/socialReelsOpenAIPrompt.ts
sed -n '220,430p' lib/openaiSocialReels.ts
sed -n '700,790p' lib/openaiSocialReels.ts
sed -n '1,420p' app/api/social-reels/discover/route.ts
sed -n '1,250p' lib/socialReelsSchema.ts
sed -n '1,260p' lib/socialReelsShortlist.ts
git diff --check
```

Result: **PASS**. No live OpenAI call was made.
