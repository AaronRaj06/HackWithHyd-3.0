"""
Seed script — loads all incidents from data/incidents.json into Hindsight memory.
Run this ONCE after setting up your API keys.
Usage: python data_seed.py
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from agent import retain_incident

SEED_PATH = Path(__file__).parent.parent / "data" / "incidents.json"


def main():
    print("🧠 IncidentIQ — Seeding Hindsight Memory")
    print("=" * 50)
    
    if not SEED_PATH.exists():
        print(f"❌ Seed file not found: {SEED_PATH}")
        sys.exit(1)
    
    with open(SEED_PATH) as f:
        incidents = json.load(f)
    
    print(f"📦 Found {len(incidents)} incidents to seed\n")
    
    success = 0
    errors = 0
    
    for i, incident in enumerate(incidents, 1):
        print(f"[{i}/{len(incidents)}] Retaining: {incident['id']} — {incident['title'][:50]}...")
        result = retain_incident(incident)
        
        if result.get("status") == "error":
            print(f"  ❌ Error: {result.get('reason')}")
            errors += 1
        elif result.get("status") == "skipped":
            print(f"  ⚠️  Skipped (no API key configured)")
            errors += 1
        else:
            print(f"  ✅ Retained successfully")
            success += 1
    
    print("\n" + "=" * 50)
    print(f"✅ Seeded: {success}  ❌ Errors: {errors}")
    
    if errors > 0:
        print("\n⚠️  Some incidents failed to seed.")
        print("   Make sure HINDSIGHT_API_KEY and HINDSIGHT_PIPELINE_ID are set in .env")
    else:
        print("\n🎉 Memory seeded! Your agent now has context from 12 past incidents.")


if __name__ == "__main__":
    main()
