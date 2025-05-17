# vibeslop

vibeslop is a playground for vibe coding AI Agents using various frameworks and technologies such as [langgraph](https://github.com/), the [a2a](https://github.com/) project, and [MCP servers](https://github.com/).

See [GOALS.md](GOALS.md) for high-level objectives.

## Subprojects

- **Banking Complaints Agent**: a minimal MCP server that fronts the [CFPB Consumer Complaints API](https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/). See [banking_complaints_agent/README.md](banking_complaints_agent/README.md) for details.

## Testing

Run the unit tests with:

```bash
python -m unittest discover -s banking_complaints_agent/tests -v
```
