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
