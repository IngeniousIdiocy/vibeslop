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

This directory also includes `nl_agent.py`, a minimal natural language agent
that calls `a2a.OpenAI` with the `meta-llama/llama-4-scout-17b-16e-instruct`
model.
