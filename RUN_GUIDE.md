# IncidentIQ — Run Guide

## Prerequisites
- Python 3.10+
- Node.js 18+
- A free Groq API key → https://console.groq.com/keys

## 1. Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

## 2. Install Frontend Dependencies
```bash
cd frontend && npm install && cd ..
```

## 3. Configure API Key
Edit `.env` and replace `your_groq_api_key_here` with your real Groq key:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. Start the App
```bash
chmod +x start.sh
./start.sh
```
Or manually:
```bash
# Terminal 1 — Backend
uvicorn backend.api:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## 5. Open
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

## 6. Seed Memory (Optional)
```bash
curl -X POST http://localhost:8000/api/memory/seed
```
This loads 12 sample incidents into Hindsight memory (requires Hindsight API key in `.env`).

## Troubleshooting
- **"LLM api key error"** → Your Groq key is invalid or missing. Get a free one at https://console.groq.com/keys
- **Port already in use** → `lsof -ti:8000 | xargs kill -9` or `lsof -ti:3000 | xargs kill -9`
- **Module not found** → Make sure you run commands from the project root (`HackWithHyd/`)
