"""
Core Hindsight-powered Incident Response Agent
Handles memory retain/recall and LLM-powered analysis
"""

import os
import json
import httpx
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "")
HINDSIGHT_PIPELINE_ID = os.getenv("HINDSIGHT_PIPELINE_ID", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen/qwen3-32b")

# Fallback models if the primary is unavailable
FALLBACK_MODELS = [
    "qwen/qwen3-32b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
]

HINDSIGHT_BASE_URL = "https://api.hindsight.vectorize.io/v1"

if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
    print("=" * 60)
    print("WARNING: GROQ_API_KEY is not set!")
    print("Please edit .env and add your Groq API key.")
    print("Get one free at: https://console.groq.com/keys")
    print("=" * 60)

groq_client = OpenAI(
    api_key=GROQ_API_KEY if GROQ_API_KEY and GROQ_API_KEY != "your_groq_api_key_here" else "dummy",
    base_url="https://api.groq.com/openai/v1",
)


def _call_llm(messages: list[dict], temperature: float = 0.3, max_tokens: int = 1200) -> str:
    """Call Groq LLM with automatic fallback to other models if the primary fails."""
    models_to_try = [LLM_MODEL] + [m for m in FALLBACK_MODELS if m != LLM_MODEL]
    last_error = None

    for model in models_to_try:
        try:
            response = groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            continue

    return f"All LLM models failed. Last error: {last_error}. Check your GROQ_API_KEY at https://console.groq.com/keys"


# ─── Hindsight Memory Functions ───────────────────────────────────────────────

def hindsight_retain(content: str, metadata: dict = None) -> dict:
    """Store a memory in Hindsight"""
    if not HINDSIGHT_API_KEY or not HINDSIGHT_PIPELINE_ID:
        return {"status": "skipped", "reason": "no_api_key"}
    
    headers = {
        "Authorization": f"Bearer {HINDSIGHT_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "pipeline_id": HINDSIGHT_PIPELINE_ID,
        "content": content,
        "metadata": metadata or {},
    }
    try:
        resp = httpx.post(
            f"{HINDSIGHT_BASE_URL}/retain",
            headers=headers,
            json=payload,
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"status": "error", "reason": str(e)}


def hindsight_recall(query: str, top_k: int = 5) -> list[dict]:
    """Recall relevant memories from Hindsight"""
    if not HINDSIGHT_API_KEY or not HINDSIGHT_PIPELINE_ID:
        return []
    
    headers = {
        "Authorization": f"Bearer {HINDSIGHT_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "pipeline_id": HINDSIGHT_PIPELINE_ID,
        "query": query,
        "top_k": top_k,
    }
    try:
        resp = httpx.post(
            f"{HINDSIGHT_BASE_URL}/recall",
            headers=headers,
            json=payload,
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", data if isinstance(data, list) else [])
    except Exception as e:
        print(f"[Hindsight recall error]: {e}")
        return []


# ─── Agent Core ───────────────────────────────────────────────────────────────

def build_incident_memory_text(incident: dict) -> str:
    """Format an incident into a rich text blob for Hindsight"""
    return f"""INCIDENT: {incident.get('id', 'N/A')} — {incident.get('title', '')}
SERVICE: {incident.get('service', 'unknown')}
SEVERITY: {incident.get('severity', 'unknown')}
TIMESTAMP: {incident.get('timestamp', '')}
DESCRIPTION: {incident.get('description', '')}
ROOT CAUSE: {incident.get('root_cause', '')}
RESOLUTION STEPS: {incident.get('resolution', '')}
RUNBOOK: {incident.get('runbook_used', 'none')}
ENGINEER: {incident.get('engineer', 'unknown')}
TAGS: {', '.join(incident.get('tags', []))}
LESSONS LEARNED: {incident.get('lessons_learned', '')}
DURATION: {incident.get('duration_minutes', '?')} minutes"""


def analyze_incident(new_incident: dict) -> dict:
    """
    Main agent function: recall similar incidents from memory,
    then use LLM to generate resolution recommendations.
    """
    query = f"{new_incident.get('title', '')} {new_incident.get('description', '')} {new_incident.get('service', '')}"
    
    # Step 1: Recall from Hindsight memory
    memories = hindsight_recall(query, top_k=4)
    
    memory_context = ""
    cited_incidents = []
    if memories:
        memory_context = "\n\n".join(
            f"[PAST INCIDENT {i+1}]\n{m.get('content', m.get('text', str(m)))}"
            for i, m in enumerate(memories)
        )
        cited_incidents = memories
    
    # Step 2: Build prompt with or without memory
    system_prompt = """You are an elite Site Reliability Engineer (SRE) with 10+ years of experience managing production systems. 
You specialize in rapid incident diagnosis and resolution.
Be specific, actionable, and concise. Format your response clearly with sections."""

    user_prompt = f"""A new production incident has been reported. Analyze it and provide immediate response recommendations.

## NEW INCIDENT
Title: {new_incident.get('title', 'Unknown')}
Service: {new_incident.get('service', 'Unknown')}
Severity: {new_incident.get('severity', 'Unknown')}
Description: {new_incident.get('description', 'No description')}

"""

    if memory_context:
        user_prompt += f"""## RELEVANT PAST INCIDENTS FROM MEMORY
The agent has encountered similar incidents before. Use these to inform your analysis:

{memory_context}

---
"""
        user_prompt += """## YOUR TASK
Using the past incidents above as context, provide:

1. **🔍 Probable Root Cause** (based on patterns from memory)
2. **⚡ Immediate Actions** (first 5 minutes — stop the bleeding)
3. **🔧 Resolution Steps** (ordered, specific commands/actions)
4. **🧠 Memory Insight** (what pattern from past incidents applies here)
5. **📋 Runbook Reference** (which past runbook to pull up)
6. **⏱️ Estimated Resolution Time** (based on similar past incidents)
"""
    else:
        user_prompt += """## YOUR TASK
No similar incidents found in memory yet. Provide general best-practice guidance:

1. **🔍 Probable Root Cause** (list the most likely causes)
2. **⚡ Immediate Actions** (first 5 minutes)
3. **🔧 Resolution Steps** (ordered diagnostic steps)
4. **📋 Investigation Checklist** (what to check)
5. **⏱️ Estimated Resolution Time** (typical range for this type of incident)

Note: As more incidents are resolved and retained, the agent will provide much more specific, memory-driven recommendations.
"""

    # Step 3: Call Groq LLM (with fallback models)
    ai_response = _call_llm(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=1200,
    )

    return {
        "analysis": ai_response,
        "memory_used": len(memories) > 0,
        "memories_recalled": len(memories),
        "cited_incidents": cited_incidents,
        "query_used": query,
    }


def retain_incident(incident: dict) -> dict:
    """Retain a resolved incident into Hindsight memory"""
    memory_text = build_incident_memory_text(incident)
    result = hindsight_retain(
        content=memory_text,
        metadata={
            "id": incident.get("id", ""),
            "service": incident.get("service", ""),
            "severity": incident.get("severity", ""),
            "tags": incident.get("tags", []),
        },
    )
    return result


def analyze_without_memory(new_incident: dict) -> dict:
    """Analyze an incident WITHOUT using Hindsight memory (for before/after demo)"""
    system_prompt = """You are an SRE engineer. A new incident has been reported. 
Provide generic troubleshooting guidance without any historical context."""

    user_prompt = f"""Incident: {new_incident.get('title', 'Unknown')}
Service: {new_incident.get('service', 'Unknown')}  
Severity: {new_incident.get('severity', 'Unknown')}
Description: {new_incident.get('description', 'No description')}

Provide generic troubleshooting steps for this type of incident."""

    ai_response = _call_llm(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=600,
    )
    return {
        "analysis": ai_response,
        "memory_used": False,
        "memories_recalled": 0,
        "cited_incidents": [],
    }
