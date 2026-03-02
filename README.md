# openai-nim-proxy

An OpenAI-compatible proxy for Nvidia NIM, deployed on Vercel.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Chat completions (proxied to NIM) |
| GET  | `/v1/models`           | List available models |

## Setup

1. Fork / clone this repo.
2. Connect to Vercel.
3. Add environment variable: `NIM_API_KEY=<your nvidia nim key>`
4. Deploy.

## Usage in JanitorAI / Chub.ai

- **Base URL:** `https://openai-nim-proxy-ruddy-six.vercel.app/v1`
- **API Key:** Your NIM API key (or leave as-is if using server-side env var)

## Behaviour

- `thinking` is automatically set to `false`
- `reasoning` is automatically set to `true`

## Models

- `minimaxai/minimax-m2.5`
- `qwen/qwen3.5-397b-a17b`
- `z-ai/glm5`
- `minimaxai/minimax-m2.1`
- `stepfun-ai/step-3.5-flash`
- `moonshotai/kimi-k2.5`
- `z-ai/glm4.7`
- `deepseek-ai/deepseek-v3.2`
- `deepseek-ai/deepseek-v3.1-terminus`
- `qwen/qwen3-next-80b-a3b-instruct`
- `mistralai/devstral-2-123b-instruct-2512`
- `mistralai/mistral-large-3-675b-instruct-2512`
- `qwen/qwen3-coder-480b-a35b-instruct`
