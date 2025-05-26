# Banking Complaints Agent Instructions

## Running tests
Use unittest to run subproject tests:
```bash
python -m unittest discover -s tests -v
```

## Setup
Install dependencies from the repository root:
```bash
pip install -r ../requirements.txt
```

A Groq API key is required for the natural-language agent. Place it in `groq_api_key.txt` (one line containing the key). The file is ignored by Git.

## Running the server
To launch the MCP server:
```bash
python server.py --transport http --host 0.0.0.0 --port 8000
```

To start the A2A façade:
```bash
MCP_URL=http://localhost:8000/complaints python a2a_facade.py
```
