# ClipMind

Process short videos once. Search them later by tags or text.

**Pipeline:** frames + audio → OCR + Whisper → clean text → Gemini tags → SQLite

## Setup

```bash
cp .env.example .env   # add GEMINI_API_KEY
# put videos in ./videos
```

## Run (Docker)

```bash
docker compose up --build
docker compose run --rm search "python"
docker compose run --rm search              # list all tags
```

## Run (local)

Needs: Node 20+, ffmpeg, Whisper CLI, Tesseract.

```bash
npm install
npm start
npm run search -- "python"
```

## Browse UI (local)

```bash
npm run ui
# open http://localhost:3456
```

Or with Docker:

```bash
docker compose up ui
# open http://localhost:3456
```

Search from the top bar. Videos play from your local `videos/` folder.

## What gets stored

Each reel in `data/clipmind.db`:

| Field | Meaning |
|-------|---------|
| `file_path` | path under `videos/` |
| `text` | cleaned unique text |
| `tags` | searchable tags |
| `duration` | length in seconds |
| `status` | `pending` / `done` / `failed` |

Already-done videos are skipped on the next run.

## Config (`.env`)

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
WHISPER_MODEL=base
OCR_INTERVAL_SECONDS=2
DELETE_CACHE_AFTER_PROCESSING=true
```
