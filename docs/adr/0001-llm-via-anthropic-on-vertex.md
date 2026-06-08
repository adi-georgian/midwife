# LLM access via Anthropic on GCP Vertex AI

For the internal Georgian deployment, all LLM calls (currently the public Anthropic SDK
plus Gemini, authed by static API keys in `.env`) will route through **Anthropic models on
GCP Vertex AI** (`AnthropicVertex` client), with Gemini also on Vertex. Reason: canvas
content must be protected aggressively (assume MNPI), and Vertex keeps inference inside
Georgian's own GCP project under existing internal-LLM data terms, rather than sending
content to the public Anthropic/Google consumer APIs. Auth shifts from static keys to
Workload Identity, removing long-lived secrets.
