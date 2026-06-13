# ClipMind 🧠🎥
> An AI-Powered Video Tagging & Local Search Engine

## 🚀 Quick Usage

1. Add your **`GEMINI_API_KEY`** in the [.env](file:///C:/data/me/git/ClipMind/.env) file.
2. Put your videos inside the [videos/](file:///C:/data/me/git/ClipMind/videos) folder.
3. Start the tagging pipeline:
   ```bash
   docker compose up --build
   ```
4. Search your videos by tags/text:
   ```bash
   docker compose run --rm search "query"
   ```

---

**ClipMind** is a fully automated, dockerized pipeline that processes a collection of short videos, extracts visual text (OCR) and speech (Whisper), filters out junk (handles, hashtags, duplicates), and uses Gemini AI to generate highly relevant search tags. All results are stored in a local SQLite database, allowing you to query and find files instantly.

---

## ✨ Features

- **🚀 Dockerized Setup**: Zero dependencies required on your host machine. Docker wraps Node.js, Python, `ffmpeg`, Tesseract OCR, and Whisper CLI.
- **⚡ Smart Multi-Stage Caching**: Step-by-step progress is cached in a local SQLite database (via Drizzle ORM). If the pipeline is interrupted, it resumes from the exact failed step (e.g., skips ffmpeg/OCR/Whisper and goes straight to Gemini).
- **📸 Visual Text Extraction (OCR)**: Scans screenshots at configurable intervals using Tesseract.js to extract on-screen overlays, captions, and text.
- **🎙️ Speech Transcription**: Extracts audio streams and runs OpenAI Whisper locally inside the container to transcribe spoken words.
- **🧹 Intelligent Cleaning**: Cleans raw text by removing usernames (e.g., `@user`), hashtags, URLs, duplicate frames, and short lowercase noise words while preserving important acronyms (e.g., `AI`, `JS`, `UI`).
- **🤖 Gemini Integration**: Uses the official Google Gen AI SDK to prompt Gemini 2.5 Flash / 3.5 Flash for structured, high-quality search tags.
- **🔍 CLI Search Engine**: Query your video catalog by tags, transcript words, or filenames with instant formatted table output.

---

## 📂 Project Structure

```
ClipMind/
├── src/
│   ├── db/
│   │   ├── schema.ts     # SQLite database structure
│   │   └── index.ts      # Migrations & database connection
│   ├── pipeline/
│   │   ├── extractor.ts  # FFMPEG frames & audio extraction
│   │   ├── ocr.ts        # Frame character recognition (Tesseract.js)
│   │   ├── transcribe.ts # Local speech-to-text (Whisper)
│   │   ├── filter.ts     # String regex filters & deduplication
│   │   └── tagger.ts     # Gemini API structured tag generation
│   ├── index.ts          # Orchestrator & CLI entrypoint
│   └── search.ts         # Query CLI tool
├── Dockerfile            # Container definition
├── docker-compose.yml    # Volume mounting & service manager
├── package.json          # Node dependencies
└── tsconfig.json         # TypeScript configuration
```

---

## 🛠️ Quick Start

### 1. Configuration
Copy `.env.example` to `.env` and fill in your Gemini API Key:
```env
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Pipeline Settings
WHISPER_MODEL=base
OCR_INTERVAL_SECONDS=2
DELETE_CACHE_AFTER_PROCESSING=true
```

### 2. Add Your Videos
Place your `.mp4`, `.mov`, `.mkv`, or `.avi` files into the `./videos` folder.

### 3. Run the Pipeline
Ensure **Docker Desktop** is running, then execute:
```bash
docker compose up --build
```
This builds the environment and runs the extraction and tagging. You will see colored, verbose console logs detailing:
- Raw OCR outputs
- Speech transcripts
- Cleaned text sent to Gemini
- Generated tags

### 4. Search Videos
To search your video collection, run the search command:
```bash
docker compose run --rm search "your search query"
```

To see a list of all available tags in your database and how many videos have them:
```bash
docker compose run --rm search
```

---

## 💾 Caching & Storage Details

- **Database location**: Mounted to `./data/clipmind.db` on your host machine.
- **Whisper models cache**: Saved to `./.cache/whisper` so models are never re-downloaded when rebuilding container.
- **Tesseract traineddata cache**: Saved to `./.cache/tesseract`.
- **Temp frames & wav audio files**: Extracted under `./.cache/` and automatically deleted upon successful tagging to save host storage space.
