# Banking Complaints Agent

This subproject provides a simple Model Context Protocol (MCP) server that 
fronts the public CFPB Consumer Complaints API. It exposes a `/complaints`
endpoint that accepts query parameters and forwards them to the CFPB API.

The server uses FastAPI and does not require any additional third-party HTTP
libraries. To run the server locally:

```bash
uvicorn banking_complaints_agent.server:app --reload
```

Example request:

```bash
curl 'http://localhost:8000/complaints?search=credit%20card&size=5'
```

This will forward the request to the CFPB API and return the result.
