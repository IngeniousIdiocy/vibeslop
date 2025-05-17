"""
Natural‑language agent that parses user questions and, via A2A, delegates
to the CFPB complaint‑search skill exposed by a2a_facade.py.
"""
import os
from typing import Dict, Any, Optional

try:
    from langgraph.graph import Graph
    from langgraph.graph import START, END
except Exception:  # pragma: no cover - optional dependency
    Graph = None

try:
    import a2a
except Exception:  # pragma: no cover - optional dependency
    a2a = None

try:
    from python_a2a import A2AClient
except Exception:  # pragma: no cover - optional dependency
    A2AClient = None

import json

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

    def __init__(self, a2a_endpoint: str = "http://localhost:9100", api_key_path: Optional[str] = None):
        if Graph is None or a2a is None or A2AClient is None:
            raise ImportError("langgraph, a2a, and python_a2a must be installed to use ComplaintNLAgent")

        self.api_key = load_groq_api_key(api_key_path)

        self.cfpb_agent = A2AClient(base_url=a2a_endpoint)

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

        # Define entry & exit and compile the graph
        self.graph.set_entry_point("parse")
        self.graph.set_finish_point("query")
        self.graph.compile()

    def _parse(self, question: str) -> Dict[str, Any]:
        """Convert a natural‑language question into MCP server parameters."""
        prompt = (
            "Parse the following banking‑complaint question into a JSON object "
            f"containing valid parameters for the MCP complaints endpoint:\n\n{question}\n"
            "Return **only** the JSON."
        )
        result = self.llm.complete(prompt)

        # Different OpenAI wrappers expose content differently; try both.
        raw_text = getattr(result, "choices", [None])[0]
        if raw_text is not None:
            raw_text = getattr(raw_text, "message", raw_text)
            raw_text = getattr(raw_text, "content", getattr(raw_text, "text", None))

        if not raw_text:
            raise ValueError("LLM did not return text in expected format")

        import json
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Expected JSON; got:\n{raw_text}") from exc

    def _query_server(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send an A2A task to the complaint‑search agent and wait for the result."""
        task = self.cfpb_agent.tasks.send(
            skill="search_complaints",
            input=params,
            streaming=False,
        )
        # Block until completion; library handles polling/SSE.
        task.wait()

        # Guard against server‑side failure or missing artifacts
        if task.state == "FAILED":
            raise RuntimeError(f"A2A task failed: {task.error}")

        if not task.artifacts:
            raise RuntimeError("A2A task returned no artifacts")

        # Expect a single JSON artifact in .artifacts[0]
        return task.artifacts[0].as_json()

    def run(self, question: str) -> Dict[str, Any]:
        """Execute the agent."""
        return self.graph.invoke(question)
