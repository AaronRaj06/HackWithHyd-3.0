# 🧠 IncidentIQ — AI Incident Response Agent

> **An AI-powered SRE agent that remembers every past incident and gets dramatically smarter over time. Built with [Hindsight](https://github.com/vectorize-io/hindsight) memory + Groq LLM.**

---

## What It Does

IncidentIQ is an AI agent that helps SRE/DevOps teams respond to production incidents faster by leveraging persistent memory. Unlike generic chatbots that forget everything, IncidentIQ:

- **Remembers** every past incident — root causes, resolution steps, runbooks used, lessons learned
- **Recalls** relevant past incidents when a new one hits
- **Improves** its recommendations with every resolved incident retained into memory
- **Shows** a clear before/after: without memory → generic advice. With memory → specific, pattern-matched resolution steps

## Tech Stack

| Layer | Technology |
|---|---|
| Memory | [Hindsight](https://github.com/vectorize-io/hindsight) by Vectorize |
| LLM | [Groq](https://groq.com) — `qwen/qwen3-32b` |
| Backend | Python + FastAPI |
| Frontend | Vanilla HTML/CSS/JS (no framework) |

## Setup

### 1. Get API Keys
- **Hindsight**: Register at [ui.hindsight.vectorize.io](https://ui.hindsight.vectorize.io) → use promo `MEMHACK99` for $50 credits
- **Groq**: Sign up at [groq.com](https://groq.com) → Create API key

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your keys
```

### 3. Install & Run Backend
```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt

# Seed Hindsight with 12 synthetic incidents
cd backend && python data_seed.py

# Start the API
uvicorn api:app --reload --port 8000
```

### 4. Open Frontend
```bash
# Open in browser
open ../frontend/index.html
# OR serve with Python
cd frontend && python3 -m http.server 3000
```

## How Hindsight Memory Works

```
New Incident Submitted
       │
       ▼
hindsight_recall(query) ──► Returns top-k similar past incidents
       │
       ▼
Groq LLM prompt = incident + memory context
       │
       ▼
Targeted, memory-grounded resolution steps
       │
       ▼
Incident Resolved → hindsight_retain(incident) ──► Memory grows
```

## Demo Flow

1. Open the **Dashboard** — see 12 incidents already in agent memory
2. Click **New Incident** → use a "Quick Fill" template
3. Watch the agent **recall similar past incidents** and generate specific fixes
4. Go to **Before vs. After** → see the difference memory makes
5. Resolve an incident → watch it get **retained into memory**
6. Submit a similar incident → agent now knows exactly what to do

## Project Structure

```
HackWithHyd/
├── backend/
│   ├── agent.py          # Hindsight retain/recall + Groq LLM
│   ├── api.py            # FastAPI routes
│   └── data_seed.py      # CLI memory seeder
├── frontend/
│   ├── index.html        # Main UI
│   ├── style.css         # Dark-mode design
│   └── app.js            # Frontend logic
├── data/
│   └── incidents.json    # 12 synthetic incidents
└── .env.example
```

## Judging Criteria Coverage

| Criteria | How We Address It |
|---|---|
| Innovation (30%) | Living runbook that evolves — not just a chatbot |
| Hindsight Memory (25%) | Every feature is memory-driven; visible before/after |
| Technical Implementation (20%) | Clean FastAPI, typed Python, documented code |
| User Experience (15%) | Premium dark UI, quick-fill templates, compare view |
| Real-world Impact (10%) | Every SRE team needs faster incident resolution |

---

Built for **HackWithHyderabad 3.0** · Powered by [Hindsight](https://github.com/vectorize-io/hindsight)
