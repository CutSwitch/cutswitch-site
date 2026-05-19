# Social Reels AI Editor Word-Edit Contract

## Endpoint

`POST /api/social-reels/edit`

This endpoint supports the legacy Social Reels edit assistant request shape and the additive word-aligned AI editor contract. Legacy behavior must remain compatible for older clients.

## Contract Version

`social_reels_ai_editor_word_edit_v1`

When a request includes this `schemaVersion`, the backend handles it as a word-edit proposal request.

## Ownership Model

- Backend proposes edit operations only.
- CutSwitch app validates source word IDs and applies the edit locally.
- Provider/OpenAI output must never be treated as final timeline truth.
- Final timing is resolved by the app from existing word IDs and local media/transcript state.

## Request Rules

The request fixture is:

`docs/contracts/social_reels_ai_editor_word_edit_request.backend_contract_fixture.json`

Required stable fields include:

- `schemaVersion`
- `requestID`
- `candidateID`
- `recipeRevisionHash`
- `transcriptNormalizationHash`
- `selectedFormat`
- `targetSpanHint`
- `currentSegments[]`
- `boundedWordWindow`
- `userInstruction`

`boundedWordWindow.words[]` is the source of truth for allowed spoken edit anchors. The backend prompt uses the bounded word window, not a full transcript payload.

## Response Rules

The response fixture is:

`docs/contracts/social_reels_ai_editor_word_edit_response.backend_fixture.json`

Required stable fields include:

- `schemaVersion`
- `requestID`
- `candidateID`
- `recipeRevisionHash`
- `transcriptNormalizationHash`
- `targetSpanRole`
- `operations[]`
- `draftSummary`
- `previewLabels`
- `confidence`
- `editorialWarnings[]`
- `needsNarrowerInstruction`
- `needsUserConfirmation`

Every spoken edit operation must reference existing request word IDs. `updateTitleSuggestion` may include generated title or caption display text, but that text is not spoken source material and must not be applied as transcript/audio.

## Allowed Operations

- `trimStart`
- `trimEnd`
- `extendStart`
- `extendEnd`
- `replaceSpanWithExistingSpan`
- `reorderExistingSegments`
- `removeFillerSubspan`
- `updateTitleSuggestion`

## Forbidden

- Synthetic spoken content
- Fake transcript text
- Generated voice/audio
- Provider/OpenAI timestamps as source of truth
- Raw text matching without word IDs
- Platform/content-risk fields such as `platformRisk`, `riskReason`, `highRiskHighReward`, `advertiserSafety`, `brandSafety`, `sexualRisk`, or `controversyRisk`
- Content-topic rejection

## Ambiguous Requests

If the user instruction is too broad to safely anchor spoken edits to existing word IDs, the backend should return `needsNarrowerInstruction: true`. It may include editorial warnings that describe ambiguity or word-boundary review needs, but not platform/content-risk judgments.

## Regression Gate

Run:

```bash
npm run test:social-reels-ai-editor-contract
```

The gate verifies:

- Request fixture parses.
- Response fixture parses.
- Contract version is `social_reels_ai_editor_word_edit_v1`.
- Response word IDs are a subset of request `boundedWordWindow` word IDs.
- Operations use allowed operation types only.
- `updateTitleSuggestion` is title-only generated text.
- Synthetic spoken text is rejected.
- Forbidden platform/content-risk fields are absent and rejected.
- Prompt includes no-synthetic-spoken-content rules.
- Prompt includes app-resolves-local-timing rules.
- Legacy edit assistant behavior remains compatible.
- No live OpenAI call is required.

Additional standard checks:

```bash
git diff --check
python3 -m json.tool docs/contracts/social_reels_ai_editor_word_edit_request.backend_contract_fixture.json >/dev/null
python3 -m json.tool docs/contracts/social_reels_ai_editor_word_edit_response.backend_fixture.json >/dev/null
```
