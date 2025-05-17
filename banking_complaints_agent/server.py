from typing import Optional, Dict, Any, Union, List
import json
import urllib.request
from urllib.parse import urlencode
from fastmcp import FastMCP  # high‑level wrapper for the Model Context Protocol SDK

API_BASE = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"
MAX_PAGE_SIZE = 100  # hard limit per CCDB‑5 API spec

# Instantiate an MCP server instance.
mcp = FastMCP("Banking Complaints")

def fetch_cfpb(params: Dict[str, Any], as_csv: bool = False) -> Union[Dict[str, Any], str]:
    """
    Low‑level helper that calls the CFPB CCDB‑5 API.

    Parameters
    ----------
    params : dict
        Query‑string parameters already mapped to official API names.
    as_csv : bool, default False
        If True, return the raw CSV text; otherwise return parsed JSON.
    """
    url = API_BASE + "?" + urlencode(params, doseq=True)
    headers = {"Accept": "text/csv" if as_csv else "application/json"}
    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode()
            if as_csv:
                return data
            return json.loads(data)
    except urllib.error.HTTPError as http_err:
        # Bubble up the API's structured error (if JSON) for easier debugging.
        detail = f"{http_err.code} {http_err.reason}"
        try:
            detail_json = json.loads(http_err.read().decode())
            detail = detail_json.get("message", detail)
        except Exception:
            pass
        raise RuntimeError(f"CFPB API error: {detail}") from http_err

@mcp.tool(description="Search CFPB consumer‑finance complaints (CCDB‑5 API)")
def search_complaints(
    search_term: Optional[str] = None,
    company: Union[str, List[str], None] = None,
    product: Union[str, List[str], None] = None,
    date_received_min: Optional[str] = None,
    state: Union[str, List[str], None] = None,
    size: int = 10,
    frm: int = 0,
    sort: Optional[str] = None,
    field: Optional[str] = None,
    format_: str = "json",
) -> Union[Dict[str, Any], str]:
    """
    Wraps the CCDB‑5 “Search” endpoint with full spec compliance.

    Parameters
    ----------
    search_term : str, optional
        Free‑text keyword(s) applied to the complaint narrative.
    company : str or list[str], optional
        Company name(s) to filter by.
    product : str or list[str], optional
        Product(s) to filter by.
    date_received_min : str, optional
        Lower‑bound ISO date (YYYY‑MM‑DD).
    state : str or list[str], optional
        2‑letter U.S. state abbreviation(s) to filter by.
    size : int, default 10
        Number of rows (1‑100) per page.
    frm : int, default 0
        Result offset (0‑based) used for pagination.
    sort : str, optional
        One of "relevance", "created_date_desc", "created_date_asc",
        or "total_amount_desc".
    field : str, optional
        Restrict returned fields ("all", "keyword", or "complaint_what_happened").
    format_ : str, default "json"
        Response format: "json" (parsed) or "csv" (raw string).

    Returns
    -------
    dict | str
        Parsed JSON object (format_="json") or raw CSV text (format_="csv").
    """
    # --- Validation -------------------------------------------------------
    if not (1 <= size <= MAX_PAGE_SIZE):
        raise ValueError(f"size must be 1–{MAX_PAGE_SIZE}")
    if format_ not in {"json", "csv"}:
        raise ValueError('format_ must be either "json" or "csv"')

    # --- Parameter mapping -------------------------------------------------
    params: Dict[str, Any] = {
        "size": size,
        "frm": frm,
        "format": format_,
    }
    if search_term:
        params["search_term"] = search_term
    if company:
        params["company"] = company
    if product:
        params["product"] = product
    if date_received_min:
        params["date_received_min"] = date_received_min
    if state:
        params["state"] = state
    if sort:
        params["sort"] = sort
    if field:
        params["field"] = field

    # --- Call API ----------------------------------------------------------
    as_csv = format_ == "csv"
    return fetch_cfpb(params, as_csv=as_csv)

if __name__ == "__main__":
    """
    When run directly, start the MCP server over HTTP on port 8000.
    This mirrors the flags passed by run_mcp_server.sh but works
    even if you invoke `python server.py` manually.
    """
    mcp.run()
