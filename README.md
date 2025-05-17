# vibeslop

vibeslop is a playground for vibe coding AI Agents using various frameworks and technologies such as [langgraph](https://github.com/), the [a2a](https://github.com/) project, and [MCP servers](https://github.com/).

See [GOALS.md](GOALS.md) for high-level objectives.

## Setup

Install the Python dependencies using `pip`:

```bash
pip install -r requirements.txt
```


## Subprojects

- **Banking Complaints Agent**: a minimal MCP server that fronts the [CFPB Consumer Complaints API](https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/). See [banking_complaints_agent/README.md](banking_complaints_agent/README.md) for details.
  The subproject now also includes an example natural language agent that uses
  `langgraph` and `a2a` with the Groq API.
