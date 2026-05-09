---
name: Provider Request
about: Request integration with a new AI model provider
title: "[PROVIDER] "
labels: provider, enhancement
assignees: ''
---

## Provider Name

e.g. Cohere, Together AI, Fireworks AI, AWS Bedrock, Azure OpenAI

## Provider API

- **Base URL:** `https://api.example.com/v1`
- **Protocol:** OpenAI-compatible / Custom
- **API Key env var:** `EXAMPLE_API_KEY`
- **Documentation:** link

## Models to Support

List the specific models and their capabilities:

| Model ID | Text | Vision | Audio | Embedding |
|----------|------|--------|-------|-----------|
| model-v1 | ✅   | ✅     | ❌    | ❌        |

## Proposed Fluent Alias

```fluent
-- How you'd like to call it
Ask example to "..." and call the result r.
Ask example/model-v1 to "..." using image photo and call the result r.
```

## Why This Provider

What makes this provider valuable to FLUENT users? Speed, cost, unique
capabilities, regional availability, open-weights, etc.

## Are You Willing to Implement It?

- [ ] Yes, I can submit a PR
- [ ] No, requesting the maintainers implement it
