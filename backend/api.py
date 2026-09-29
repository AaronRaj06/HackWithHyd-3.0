"""
FastAPI backend for the Incident Response Agent
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from agent import analyze_incident, retain_incident, analyze_without_memory, hindsight_recall

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="IncidentIQ — AI Incident Response Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active incidents (in prod, use a DB)
INCIDENTS_STORE: dict = {}

# Path to seed data
SEED_DATA_PATH = Path(__file__).parent.parent / "data" / "incidents.json"


# ─── Schemas ──────────────────────────────────────────────────────────────────

class NewIncidentRequest(BaseModel):
    title: str
    description: str
    service: str
    severity: str = "P2"  # P1, P2, P3, P4
    reporter: Optional[str] = "Unknown"


class ResolveIncidentRequest(BaseModel):
    incident_id: str
    root_cause: str
    resolution: str
    engineer: str
    duration_minutes: int
    lessons_learned: Optional[str] = ""
    runbook_used: Optional[str] = ""
    tags: Optional[list[str]] = []


class CompareRequest(BaseModel):
    title: str
    description: str
    service: str
    severity: str = "P2"


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "IncidentIQ API is running", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/api/incident/analyze")
def analyze_new_incident(req: NewIncidentRequest):
    """Submit a new incident and get AI-powered analysis with memory"""
    incident_id = f"INC-{str(uuid.uuid4())[:6].upper()}"
    
    incident_data = {
        "id": incident_id,
        "title": req.title,
        "description": req.description,
        "service": req.service,
        "severity": req.severity,
        "reporter": req.reporter,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    
    # Run the agent
    result = analyze_incident(incident_data)
    
    # Store the incident
    incident_data["analysis"] = result["analysis"]
    incident_data["memory_used"] = result["memory_used"]
    incident_data["memories_recalled"] = result["memories_recalled"]
    INCIDENTS_STORE[incident_id] = incident_data
    
    return {
        "incident_id": incident_id,
        "analysis": result["analysis"],
        "memory_used": result["memory_used"],
        "memories_recalled": result["memories_recalled"],
        "cited_incidents": result.get("cited_incidents", []),
        "incident": incident_data,
    }


@app.post("/api/incident/compare")
def compare_with_and_without_memory(req: CompareRequest):
    """Compare agent response with vs without Hindsight memory (demo feature)"""
    incident_data = {
        "title": req.title,
        "description": req.description,
        "service": req.service,
        "severity": req.severity,
    }
    
    without = analyze_without_memory(incident_data)
    with_memory = analyze_incident(incident_data)
    
    return {
        "without_memory": without["analysis"],
        "with_memory": with_memory["analysis"],
        "memories_recalled": with_memory["memories_recalled"],
        "memory_used": with_memory["memory_used"],
    }


@app.post("/api/incident/resolve")
def resolve_incident(req: ResolveIncidentRequest):
    """Mark an incident resolved and retain learnings into Hindsight memory"""
    if req.incident_id not in INCIDENTS_STORE:
        # Allow resolving incidents not in our local store (from seed data)
        incident = {"id": req.incident_id}
    else:
        incident = INCIDENTS_STORE[req.incident_id]
    
    # Build full incident record for memory retention
    full_incident = {
        **incident,
        "root_cause": req.root_cause,
        "resolution": req.resolution,
        "engineer": req.engineer,
        "duration_minutes": req.duration_minutes,
        "lessons_learned": req.lessons_learned,
        "runbook_used": req.runbook_used,
        "tags": req.tags,
        "status": "resolved",
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Retain into Hindsight
    memory_result = retain_incident(full_incident)
    
    # Update store
    INCIDENTS_STORE[req.incident_id] = full_incident
    
    return {
        "status": "resolved",
        "incident_id": req.incident_id,
        "memory_retained": memory_result,
        "incident": full_incident,
    }


@app.get("/api/incidents")
def list_incidents():
    """List all incidents in the current session"""
    incidents = list(INCIDENTS_STORE.values())
    incidents.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"incidents": incidents, "total": len(incidents)}


@app.get("/api/incidents/{incident_id}")
def get_incident(incident_id: str):
    """Get a specific incident"""
    if incident_id not in INCIDENTS_STORE:
        raise HTTPException(status_code=404, detail="Incident not found")
    return INCIDENTS_STORE[incident_id]


@app.post("/api/memory/seed")
def seed_memory():
    """Seed Hindsight with all synthetic incidents from data/incidents.json"""
    if not SEED_DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="Seed data file not found")
    
    with open(SEED_DATA_PATH) as f:
        incidents = json.load(f)
    
    results = []
    for inc in incidents:
        result = retain_incident(inc)
        results.append({"id": inc["id"], "title": inc["title"], "result": result})
    
    return {
        "seeded": len(results),
        "results": results,
        "message": f"Successfully retained {len(results)} incidents into Hindsight memory",
    }


@app.get("/api/memory/recall")
def recall_memories(query: str, top_k: int = 5):
    """Directly query Hindsight memory"""
    memories = hindsight_recall(query, top_k=top_k)
    return {"query": query, "results": memories, "count": len(memories)}


@app.get("/api/seed-data")
def get_seed_data():
    """Get seed incidents for the UI to display"""
    if not SEED_DATA_PATH.exists():
        return {"incidents": []}
    with open(SEED_DATA_PATH) as f:
        incidents = json.load(f)
    return {"incidents": incidents}


# ─── Serve React Frontend (Production) ────────────────────────────────────────

REACT_BUILD_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if REACT_BUILD_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(REACT_BUILD_DIR / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_react(full_path: str):
        """Serve React frontend for all non-API routes"""
        file_path = REACT_BUILD_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(REACT_BUILD_DIR / "index.html"))
