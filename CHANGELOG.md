# FLUENT Changelog

All notable changes to the FLUENT language runtime are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-05-09 — Initial Release

### Added

#### Runtime & CLI
- `fluent run <file>` — Execute any `.fl` program with full AST evaluation
- `fluent test <dir>` — Test runner with pretty / json / tap reporters; semantic and exact-match assertions
- `fluent serve <file>` — Expose any Fluent procedure as an HTTP REST API via `@expose` annotations
- `fluent estimate <file>` — Pre-flight cost estimator with per-model breakdown table and `--json` output
- `fluent repl` — Interactive read-eval-print loop with `.vars`, `.clear`, `.help` meta-commands
- `fluent build <file>` — Parse and emit `*.ast.json` bundle for inspection or tooling
- `fluent env set / list` — Encrypted credential vault stored at `~/.fluent/credentials.json`
- `--dry-run`, `--trace <path>`, `--replay <path>` flags for `fluent run`

#### Parser
- Full NL-EBNF parser for all 7 Fluent syntactic constructs
- Annotation pre-processor (`@model`, `@stream`, `@expose`, `@returns`, `@retry`, etc.)
- Multi-line statement joining with continuation detection
- Block statement parsing: `For each`, `While`, `In parallel`, `To … End of`, `Test … End test`, `Validate … End validate`
- Expression parser: literals, identifiers, field access, records, lists, arithmetic, `or else`, function calls
- Condition parser: `is`, `is not`, `is greater than`, `contains`, `exists`, `is empty`, `and`, `or`, `not`

#### Executor
- Async recursive AST walker with full scope chain
- Closure-correct `Scope` — writes propagate to the declaring scope (parent-aware `set`)
- Parallel execution via `Promise.all` for `In parallel` and `for each … parallel`
- `Try … If that fails` multi-fallback error handling
- `Remember` / `Recall` in-process semantic memory store
- `Validate` block with `Expect` assertions (exact, semantic, `not` negation)
- `Define model` aliasing — swap providers by changing one word
- `Define persona` — reusable system prompts

#### Provider Registry
- **Anthropic** (`claude`, `anthropic`) — claude-opus-4, claude-sonnet-4-6, claude-haiku-4-5
- **OpenAI** (`gpt`, `openai`) — gpt-4o, gpt-4.1, o4-mini
- **Google** (`gemini`, `google`) — gemini-2.0-flash, gemini-2.5-pro
- **Mistral** (`mistral`) — mistral-large-latest
- **Groq** (`groq`, `llama`, `meta`) — llama-3.3-70b-versatile
- **DeepSeek** (`deepseek`) — deepseek-chat
- **xAI** (`grok`, `xai`) — grok-3-mini
- **Perplexity** (`perplexity`) — sonar-pro
- **Custom / local** — any OpenAI-compatible endpoint via `Register provider`
- Mock responses when API keys are absent (graceful degradation)
- Unified pricing table for cost estimation

#### Examples
- `hello.fl` — Hello World, arithmetic, and function definition
- `sentiment.fl` — AI sentiment classification loop
- `pipeline.fl` — Multi-model parallel pipeline with `Define model` aliasing
- `api.fl` — HTTP API with `@expose` annotated procedures

#### Tests
- `test_hello.fl` — 14 core language tests (no API key required)
- `test_pipeline.fl` — 10 control-flow and pipeline tests
- `test_types.fl` — 12 type system and expression tests
- **36 / 36 tests passing** on a clean install with no API keys

---

## [Unreleased] — Roadmap

### Planned for v1.1
- VSCode extension (syntax highlighting, autocomplete, inline cost estimates)
- Jupyter kernel for interactive Fluent notebooks
- Native Oracle 23ai vector store integration
- Fine-tuning orchestration: prepare dataset, kick off run, register model
- OpenTelemetry trace export (Jaeger, Datadog, Honeycomb)
- WebAssembly compilation target
- Fluent Registry v1 — public package hosting
- `fluent trace view` — interactive trace viewer in terminal
- `fluent diff` — semantic output comparison between two traces
