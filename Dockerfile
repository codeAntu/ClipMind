# Use Node.js 20 Bookworm Slim as base
FROM node:20-bookworm-slim

# Install system dependencies
# - ffmpeg: for frame and audio extraction
# - tesseract-ocr & tesseract-ocr-eng: for OCR
# - python3, python3-pip, python3-venv: for running Whisper CLI
# - build-essential & python3-dev: needed for compiling native Node modules like better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up Python Virtual Environment for Whisper
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install CPU-only PyTorch to keep the image size small
# Install openai-whisper inside the virtual environment
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install --no-cache-dir openai-whisper

# Set working directory
WORKDIR /app

# Copy package files first for caching layers
COPY package*.json ./

# Install npm dependencies (compiles native addons inside the container)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript (fail the image build if compile fails)
RUN npm run build

# Define volumes for external data
VOLUME [ "/app/videos", "/app/data", "/app/.cache" ]

# Default command to run the tagger pipeline
CMD [ "npm", "run", "start" ]
