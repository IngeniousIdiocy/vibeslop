import a2a


def call_llama(prompt: str, **kwargs) -> str:
    """Call the meta-llama/llama-4-scout-17b-16e-instruct model via a2a."""
    client = a2a.OpenAI(model="meta-llama/llama-4-scout-17b-16e-instruct")
    response = client.complete(prompt, **kwargs)
    return response.text
