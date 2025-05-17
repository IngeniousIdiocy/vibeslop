import os
from typing import Dict, Any, Optional

try:
    from langgraph.graph import Graph
except Exception:  # pragma: no cover - optional dependency
    Graph = None

try:
    import a2a
except Exception:  # pragma: no cover - optional dependency
    a2a = None

import json
import urllib.request
from urllib.parse import urlencode

GROQ_API_BASE = "https://api.groq.com/openai/v1"
API_KEY_PATH = os.path.join(os.path.dirname(__file__), "groq_api_key.txt")


def load_groq_api_key(path: Optional[str] = None) -> str:
    """Load the Groq API key from a local file."""
    if path is None:
        path = API_KEY_PATH
    if not os.path.exists(path):
        return "your_api_key_here"
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


class ComplaintNLAgent:
    """Agent that parses natural language queries and fetches complaints."""

    def __init__(self, server_url: str = "http://localhost:8000", api_key_path: Optional[str] = None):
        if Graph is None or a2a is None:
            raise ImportError("langgraph and a2a must be installed to use ComplaintNLAgent")

        self.server_url = server_url
        self.api_key = load_groq_api_key(api_key_path)

        # Configure the LLM via a2a using Groq's OpenAI-compatible endpoint.
        self.llm = a2a.OpenAI(
            base_url=GROQ_API_BASE,
            api_key=self.api_key,
            model="meta-llama/llama-4-scout-17b-16e-instruct",
        )

        self.graph = Graph()
        self.graph.add_node("parse", self._parse)
        self.graph.add_node("query", self._query_server)
        self.graph.add_edge("parse", "query")

    def _parse(self, question: str) -> Dict[str, Any]:
        """Use the LLM to convert a question into MCP server parameters."""
        prompt = f"Parse the following banking complaint question into JSON parameters for the MCP server: {question}"
        result = self.llm.complete(prompt)
        return result.json()

    def _query_server(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = urlencode(params)
        url = f"{self.server_url}/complaints?{query}"
        with urllib.request.urlopen(url) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Server returned status {resp.status}")
            data = resp.read()
            return json.loads(data.decode())

    def run(self, question: str) -> Dict[str, Any]:
        """Execute the agent."""
        return self.graph.invoke(question)
