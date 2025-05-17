

"""
Thin A2A façade that exposes the existing MCP complaint‑search tool as an
Agent‑to‑Agent (A2A) skill so peer agents can invoke it via Google’s
A2A protocol.

Run:
    python a2a_facade.py          # listens on http://localhost:9100

Environment variables:
    MCP_URL  – Full URL of the MCP complaints endpoint to delegate to.
               Default: http://localhost:8000/complaints
"""
from __future__ import annotations

import os
import requests
from python_a2a import A2AServer, AgentCard, Skill

# ---------------------------------------------------------------------------
# Agent metadata (served automatically at /.well‑known/agent.json)
# ---------------------------------------------------------------------------

CARD = AgentCard(
    id="urn:agent:cfpb-complaint-search",
    name="CFPB Complaint Search",
    description=(
        "Searches the U.S. Consumer Financial Protection Bureau (CFPB) "
        "Consumer Complaint Database via an existing MCP tool."
    ),
    skills=[
        Skill(
            name="search_complaints",
            description="Search the CFPB CCDB‑5 dataset",
            input_schema={"type": "object"},  # accept any JSON object
        )
    ],
)

# ---------------------------------------------------------------------------
# Delegate configuration
# ---------------------------------------------------------------------------

MCP_URL = os.environ.get("MCP_URL", "http://localhost:8000/complaints")

app = A2AServer(agent_card=CARD)


@app.skill("search_complaints")
def search_complaints(request):
    """
    Forward the task to the MCP server and wrap the JSON response
    in an A2A Artifact.
    """
    try:
        resp = requests.get(MCP_URL, params=request.input, timeout=30)
        resp.raise_for_status()
    except requests.HTTPError as exc:
        # Return an error Artifact so caller sees a structured failure.
        return app.error_artifact(str(exc))

    # Wrap the JSON payload in a success Artifact.
    return app.json_artifact(resp.json())


if __name__ == "__main__":
    # Listen on all interfaces so it’s reachable from Docker/VMs.
    app.run(host="0.0.0.0", port=9100)