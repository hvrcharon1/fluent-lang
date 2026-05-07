# FLUENT — Natural Language AI Programming Language

> *A programming language built for the age of universal AI — where every model, every provider, every capability is one sentence away.*

**Version:** 1.0 Alpha  
**Status:** Specification / Proposal  
**Paradigm:** Natural Language · AI-Native · Provider-Agnostic

---

## What is Fluent?

Fluent is a programming language written entirely in natural language (English-like sentences). It is built around one radical idea: **AI models are first-class citizens**, not library calls.

```fluent
Ask claude to "summarize the quarterly report" and call the result summary.
Ask gemini to "translate this to Hindi" using text summary and call the result hindi_summary.
Output hindi_summary.
```

No semicolons. No curly braces. No SDK boilerplate. If you can describe it, you can program it.

---

## Key Features

- **7 syntactic constructs** — all natural English grammar patterns
- **12+ built-in providers** — Anthropic, OpenAI, Google, Mistral, Meta, Cohere, Groq, DeepSeek, xAI, Perplexity, Hugging Face, and any custom OpenAI-compatible endpoint
- **Multi-model pipelines** — chain models in sequence or run them in parallel
- **Agentic loops** — goal-directed agents with tools, human-in-the-loop, and multi-agent teams
- **Multimodal** — text, images, audio, video, documents as first-class types
- **AI-aware testing** — exact, semantic, and model-judged assertions
- **Interop** — call Python, Node.js, REST APIs from Fluent; embed Fluent in any language
- **Cost management** — budget limits, automatic model escalation, token tracking

---

## Specification

The full language specification is in [`index.html`](./index.html). Open it in a browser for the best reading experience, or view it via GitHub Pages.

### Sections Covered

| # | Section |
|---|---------|
| 01 | Philosophy & Design Principles |
| 02 | Syntax Reference (7 constructs) |
| 03 | Model Binding & Invocation |
| 04 | Universal Provider Registry |
| 05 | Control Flow (conditionals, loops, error handling) |
| 06 | Multi-Model Pipelines |
| 07 | Standard Library (memory, retrieval, tools, embeddings) |
| 08 | Full Program Examples (2) |
| 09 | Functions & Modules |
| 10 | Autonomous Agents & Reflection Loops |
| 11 | Multimodal I/O (vision, audio, image generation) |
| 12 | Testing (exact, semantic, model-judged) |
| 13 | Interoperability (Python, Node, REST, HTTP export) |
| 14 | Runtime & Execution Model + CLI |
| 15 | Full Program Examples (3 more) |

---

## Quick Syntax Reference

```fluent
-- Declaration
Let name be "Harshal".

-- Model invocation
Ask claude to "explain this concept" using text my_text and call the result explanation.

-- Fully qualified
Ask anthropic/claude-opus-4 to "analyze risks" using document contract and call the result risks.

-- Conditional
If sentiment is "negative", then ask claude to "draft an apology" and call the result reply.
Otherwise, let reply be "Thank you for your feedback!".

-- Parallel loop
In parallel, for each article in articles:
    Ask gemini to "summarize this" using text article and call the result article.summary.
End parallel loop.

-- Agent
@tools(web_search, send_email)
@agent(model: anthropic/claude-opus-4)
Run agent with goal "Research top 5 competitors and email a report to team@company.com" and call the outcome result.

-- Function definition
To summarize an article (article_text) in (language):
    Ask claude to "summarize in three sentences" using text article_text and return the result.
End of summarize an article.
```

---

## Supported Providers

| Provider | Alias | Key Models |
|----------|-------|-----------|
| Anthropic | `claude` | claude-opus-4, claude-sonnet-4-6, claude-haiku-4-5 |
| OpenAI | `gpt` | gpt-4o, gpt-4.1, o3, o4-mini |
| Google | `gemini` | gemini-2.5-pro, gemini-2.5-flash |
| Mistral | `mistral` | mistral-large-3, codestral |
| Meta | `llama` | llama-4-scout, llama-4-maverick |
| Cohere | `cohere` | command-r-plus, embed-v3 |
| Groq | `groq` | llama-4-scout-instant |
| DeepSeek | `deepseek` | deepseek-r2, deepseek-coder |
| xAI | `grok` | grok-3, grok-3-mini |
| Perplexity | `perplexity` | sonar-pro |
| Hugging Face | `hf` | Any inference endpoint |
| Custom | any name | Any OpenAI-compatible API |

---

## CLI

```bash
npm install -g fluent-lang    # Install
fluent run program.fl         # Run a program
fluent test ./tests/          # Run tests
fluent serve api.fl --port 8080  # Serve as HTTP API
fluent estimate program.fl    # Estimate cost before running
fluent repl                   # Interactive REPL
```

---

## License

This specification is released as an open proposal. Contributions, feedback, and implementations welcome.

---

*Designed to be read by humans. Executed by machines.*
