# FLUENT Changelog

All notable changes to the FLUENT language runtime are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.1] — 2026-05-09 — Multimodal File Support + Open Source

### Added

#### File Runtime (`src/runtime/files.js`)
- `loadFile(kind, path, opts)` — universal file loader returning typed values
- **Image loader** — JPG, PNG, WEBP, GIF, BMP, SVG → `{ type, filename, mimeType, base64, dataUri, size }`
- **Audio loader** — MP3, WAV, FLAC, OGG, M4A, AAC → `{ type, filename, mimeType, base64, size }`
- **Video loader** — MP4, MOV, AVI, MKV, WEBM → `{ type, filename, mimeType, base64, size, frames }`
- **Document loader** — PDF (via pdf-parse), DOCX (via mammoth), TXT, MD, CSV, JSON, XML, HTML → `{ type, filename, text, size }`
- `loadFromBuffer(buffer, filename, mimeType)` — for HTTP uploads; same typed return values
- Auto-detects file kind from extension when using `read file "path"`

#### Parser
- `load image "path"` expression → `LoadFile` AST node (kind: image)
- `load audio "path"` expression → `LoadFile` AST node (kind: audio)
- `load video "path" [sampled at N frames per second]` → `LoadFile` node with fps
- `load document "path"` / `read file "path"` → `LoadFile` node (kind: document)

#### Executor
- `LoadFile` case in `evalExpr` — calls `files.loadFile` and returns typed value
- File values flow transparently through scope, loops, and function calls

#### Providers — Multimodal Content Blocks
- **Anthropic:** image inputs sent as `{ type: "image", source: { type: "base64", ... } }` content blocks
- **OpenAI:** image inputs sent as `{ type: "image_url", image_url: { url: "data:..." } }` parts
- **Google Gemini:** image, audio, and video inputs sent as `{ inline_data: { mime_type, data } }` parts
- Document text is always extracted and appended to the text content for all providers
- File inputs and text inputs are cleanly separated in the call pipeline

#### `fluent serve` — Multipart File Upload
- Added `multer` for `multipart/form-data` uploads (memory storage, 50 MB limit)
- All routes automatically accept: `file`, `files`, `image`, `images`, `audio`, `video`, `document`, `documents`, `attachment`, `attachments`
- Uploaded files are loaded into scope by field name AND by detected kind
- `POST /upload` — generic endpoint: receives any file, runs the full program, returns scope
- Response includes `uploaded` summary (no base64 in response body), `scope`, and `meta`

#### Examples
- `examples/vision.fl` — multi-provider image analysis pipeline (Claude + GPT-4o + Gemini)
- `examples/document-qa.fl` — PDF/DOCX Q&A with metadata extraction, FAQ, executive summary
- `examples/audio-transcribe.fl` — Whisper transcription → action items → decisions → summary
- `examples/multimodal-api.fl` — HTTP API with `/analyse-image`, `/analyse-document`, `/transcribe`, `/smart-extract`
- `examples/assets/sample.jpg` — minimal JPEG for CI testing
- `examples/assets/sample.txt` — sample text document for CI testing

#### Tests
- `tests/test_files.fl` — 8 new file-loading tests (no API keys required)
- **Total: 44/44 tests passing**

#### Open Source
- `LICENSE` — MIT License (Datacules LLC, 2026)
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- `SECURITY.md` — Vulnerability reporting, credential safety, prompt injection guidance
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/ISSUE_TEMPLATE/provider_request.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/test.yml` — CI matrix: Node 18/20/22, dry-run, build, cost estimate, npm audit
- `.github/workflows/publish.yml` — npm publish on GitHub release

#### Dependencies
- Added `multer@^1.4.5-lts.1` — multipart file upload
- Added `mime-types@^2.1.35` — MIME type detection from file extensions
- Optional: `pdf-parse@^1.1.1` (PDF text extraction)
- Optional: `mammoth@^1.7.1` (DOCX text extraction)


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
