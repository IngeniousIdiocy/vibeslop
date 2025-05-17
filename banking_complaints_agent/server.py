from fastapi import FastAPI, HTTPException
from typing import Optional, Dict, Any
import json
import urllib.request
from urllib.parse import urlencode

API_BASE = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"

app = FastAPI(title="Banking Complaints Agent MCP Server")


def fetch_cfpb(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch data from the CFPB complaints API."""
    query = urlencode(params)
    url = API_BASE + "?" + query
    try:
        with urllib.request.urlopen(url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=resp.status, detail="CFPB API error")
            data = resp.read()
            return json.loads(data.decode())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/complaints")
async def get_complaints(search: Optional[str] = None, company: Optional[str] = None, size: int = 10):
    """Proxy endpoint that returns complaints from the CFPB API."""
    params: Dict[str, Any] = {"size": size}
    if search:
        params["searchTerm"] = search
    if company:
        params["company"] = company
    return fetch_cfpb(params)
