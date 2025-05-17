# Banking Complaints Agent

This subproject provides a simple Model Context Protocol (MCP) server that
fronts the public CFPB Consumer Complaints API. It exposes a `/complaints`
endpoint that accepts a few query parameters and forwards them to the CFPB API.
The supported parameters are:

- `search` – text to search within complaints
- `company` – filter by company name
- `product` – complaint product category
- `date` – minimum complaint receipt date (`YYYY-MM-DD`)
- `state` – U.S. state abbreviation
- `size` – number of results to return

The server uses FastAPI and does not require any additional third-party HTTP
libraries. To run the server locally:

```bash
uvicorn banking_complaints_agent.server:app --reload
```

Example request:

```bash
curl 'http://localhost:8000/complaints?search=credit%20card&product=Mortgage&state=CA&date=2023-01-01&size=5'
```

This will forward the request to the CFPB API and return the result.

## Natural Language Agent

A minimal natural language agent powered by `langgraph` and the `a2a` project
can translate user questions into parameters for the MCP server. The agent
requires a Groq API key and expects it in a file named `groq_api_key.txt` in
this directory. The file is ignored by git. Put your key inside the file like:

```text
your_api_key_here
```

Then you can use the agent:

```python
from banking_complaints_agent import ComplaintNLAgent

agent = ComplaintNLAgent(server_url="http://localhost:8000")
result = agent.run("Show me mortgage complaints in CA from 2024")
print(result)
```

Storing the key in an ignored file or environment variable keeps the key out of
your public repository, which is generally considered a best practice.

# Banking Complaints Agent

This sub‑project now consists of **three loosely‑coupled pieces**:

| Component | Protocol | What it does | How to run |
|-----------|----------|--------------|------------|
| `server.py` | **MCP** (Model Context Protocol) | Wraps the CFPB Consumer Complaint Database (CCDB‑5) “search” endpoint and exposes it as an MCP *tool* called **`search_complaints`** | `python server.py --transport http --port 8000` |
| `a2a_facade.py` | **A2A** (Google Agent‑to‑Agent) | Presents the same `search_complaints` capability as an A2A *skill* so peer agents can discover & call it | `python a2a_facade.py` (listens on port 9100) |
| `nl_agent.py` | **Client** (LangGraph + python‑a2a) | Turns a natural‑language question into JSON parameters, calls the A2A façade, and returns the results | see code snippet below |

> **Why two protocols?**  
> MCP is the emerging standard for *agent ↔ tool* communication, already supported by Claude Desktop, Gemini AgentSpace, etc.  
> A2A handles *agent ↔ agent* orchestration. The façade is just a 40‑line bridge—keep both and you’re future‑proof.

---

## 1 · Running the stack locally

```bash
# 1. MCP server (port 8000)
python server.py --transport http --host 0.0.0.0 --port 8000

# 2. A2A façade (port 9100, delegates to MCP_URL)
MCP_URL=http://localhost:8000/complaints python a2a_facade.py
```

Both scripts hot‑reload if you install `watchfiles`.

---

## 2 · Using the natural‑language agent

```python
from banking_complaints_agent.nl_agent import ComplaintNLAgent

agent = ComplaintNLAgent(a2a_endpoint="http://localhost:9100")
print(agent.run("Show me credit‑card complaints about Wells Fargo in Texas from 2024"))
```

### Prerequisites

* Python 3.9+  
* `pip install -r requirements.txt` (installs `langgraph`, `python-a2a`, `fastmcp`, etc.)  
* Groq API key in `groq_api_key.txt` (ignored by git).

---

## 3 · MCP tool parameters

| Parameter | Type | Notes |
|-----------|------|-------|
| `search_term` | `str` | Free‑text search query |
| `company` | `str | list[str]` | Company name(s) |
| `product` | `str | list[str]` | Product category |
| `state` | `str | list[str]` | Two‑letter U.S. state code |
| `date_received_min` | `YYYY‑MM‑DD` | Lower date bound |
| `size` | `int` (1‑100) | Page size (default 10) |
| `frm` | `int` | Offset for pagination |
| `sort` | `str` | `relevance`, `created_date_desc`, etc. |
| `field` | `str` | `all`, `keyword`, or `complaint_what_happened` |
| `format` | `str` | `json` (default) or `csv` |

Example raw call:

```bash
curl 'http://localhost:8000/complaints?search_term=mortgage&state=CA&size=5'
```

---

## 4 · Project layout

```
banking_complaints_agent/
├── server.py         # FastMCP MCP server
├── a2a_facade.py     # 40‑line A2A façade
├── nl_agent.py       # LangGraph + python‑a2a NL agent
├── groq_api_key.txt  # ← put your key here (ignored)
└── README.md
```

Happy hacking!