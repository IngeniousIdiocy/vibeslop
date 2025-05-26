# Repository Instructions

## Setup
Install dependencies with:
```bash
pip install -r requirements.txt
```

## Running tests
Run the unit tests with:
```bash
python -m unittest discover -s banking_complaints_agent/tests -v
```

## Groq API Key
Place your Groq API key in `banking_complaints_agent/groq_api_key.txt`. This file should contain the key on a single line and is ignored by Git.

## Coding conventions
Follow standard PEP8 style guidelines for Python code. No additional linters are configured.

## Notes
The agent environment does not have network access during test execution. Tests should not rely on external services.

See each subdirectory's `AGENTS.md` for project-specific instructions.
