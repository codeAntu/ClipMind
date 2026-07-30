# Idea: Two-Phase Pipeline

Split processing so CPU work and Gemini tagging don’t block each other.

## Why

Right now one reel does: extract → OCR → (Whisper) → filter → Gemini → save.

Problems at scale (~1500 reels):

- OCR/CPU sits idle while waiting on Gemini
- Gemini free-tier quota (429) stops the whole reel, even if OCR already finished
- A crash forces redoing expensive local work

## Proposed flow

### Phase 1 — Extract (local only)

For each reel:

1. ffmpeg frames (+ optional Whisper)
2. OCR
3. Clean/filter text
4. Save to SQLite

**Store:** `file_path`, `file_hash`, `duration`, `text`, `status = extracted`  
**Do not** keep permanent frame PNGs in the DB — only the cleaned text.

Run this as hard/fast as the machine allows (parallel reels OK). No Gemini calls.

### Phase 2 — Tag (API only)

1. Read rows where `status = extracted` (and `text` is present)
2. Call Gemini for tags
3. Save `tags`, set `status = tagged` (or `failed`)

Can retry slowly, respect rate limits, pause/resume anytime. No re-OCR.

## Suggested statuses

| Status | Meaning |
|--------|---------|
| `pending` | not processed |
| `extracted` | text ready, no tags yet |
| `tagged` | done (searchable) |
| `failed` | error (phase 1 or 2) |

## Commands (future)

```bash
npm run extract   # phase 1 — all reels, local CPU
npm run tag       # phase 2 — Gemini on extracted rows
npm run search    # unchanged
```

## Benefits

- CPU fully used in phase 1
- Gemini quota doesn’t waste OCR work
- Re-tag later with a better prompt without re-extracting
- Matches the “pipeline overlap” idea: finish local work for many items, then drain the AI queue

## Not doing now

This is a design note only — not implemented yet. Current code still runs extract + tag in one pass per video.
