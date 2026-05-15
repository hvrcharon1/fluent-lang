<p align="center">
  <img src="assets/banner.svg" alt="FLUENT — Natural Language AI Programming Language" width="100%">
</p>

<p align="center">
  <img src="assets/logo-mark.svg" alt="FLUENT logo mark" width="80" height="80">
</p>

# FLUENT — Natural Language AI Programming Language

> *Write AI programs in plain English. Every model, every provider, one sentence away.*

[![npm version](https://img.shields.io/badge/npm-1.0.1-orange)](https://www.npmjs.com/package/fluent-lang)
[![tests](https://img.shields.io/badge/tests-101%20passed-brightgreen)](https://github.com/hvrcharon1/fluent-lang/actions)
<!-- Logo: Bold gradient F with neural-network speech-bubble cutout. Cyan→Blue→Purple. -->

[![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/hvrcharon1/fluent-lang/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![CI](https://github.com/hvrcharon1/fluent-lang/actions/workflows/test.yml/badge.svg)](https://github.com/hvrcharon1/fluent-lang/actions/workflows/test.yml)

---

## Installation

```bash
npm install -g fluent-lang
```

Or run locally from this repository:

```bash
git clone https://github.com/hvrcharon1/fluent-lang.git
cd fluent-lang
npm install
node bin/fluent.js --help
```

---

## CLI Commands

```bash
# Core
fluent run program.fl                   # Run a Fluent program
fluent run program.fl --dry-run         # Validate only, no execution
fluent run program.fl --trace out.json  # Write execution trace
fluent test ./tests/                    # Run test files (101/101 ✓)
fluent test ./tests/ --filter "name"    # Filter by test name
fluent serve api.fl --port 8080 --cors  # Expose as HTTP API
fluent estimate program.fl              # Estimate API cost
fluent estimate program.fl --json       # JSON cost breakdown
fluent repl                             # Interactive REPL
fluent build program.fl                 # Parse and emit .ast.json bundle

# Project
fluent init my-project                  # Scaffold a new project
fluent lint ./examples/                 # Static analysis
fluent lint program.fl --quiet          # Only show files with issues

# Traces
fluent trace view out.json              # Pretty-print execution trace
fluent trace cost out.json              # Cost breakdown by model
fluent trace diff run1.json run2.json   # Semantic diff between runs

# Credentials
fluent env set ANTHROPIC_API_KEY=sk-ant-...
fluent env list
```

---

## Quick Syntax Reference

```fluent
-- Declaration
Let name be "Harshal".

-- Model invocation (any provider, one sentence)
Ask claude to "explain this concept" using text my_text and call the result explanation.

-- Fully qualified provider
Ask anthropic/claude-opus-4 to "analyze risks" using document contract and call the result risks.

-- Define a reusable model alias
Define model analyst as anthropic/claude-sonnet-4-6 with temperature 0.1, max_tokens 2000.

-- Conditional
If sentiment is "negative", then ask claude to "draft an apology" and call the result reply.
Otherwise, let reply be "Thank you for your feedback!".

-- For-each loop
For each article in articles:
    Ask gemini to "summarise this" using text article and call the result article_summary.
End loop.

-- Parallel execution
In parallel, for each doc in documents:
    Ask fast_model to "classify" using text doc and call the result doc_category.
End parallel loop.

-- Function definition
To summarise an article (article_text) in (language):
    Ask claude to "summarise in three sentences" using text article_text and call the result s.
    Return s.
End of summarise an article in.

-- Error handling with fallback
Try to ask openai/gpt-4o to "process request" using text input and call the result r.
If that fails, ask claude to "process request" using text input and call the result r.
If that also fails, let r be "Service unavailable.".

-- HTTP API endpoint
@expose(as: http, path: "/classify", method: POST)
To classify message (message):
    Ask claude to "classify as: question, complaint, compliment, or other" using text message and call the result cat.
    Return cat.
End of classify message.
```

---

## Supported Providers

| Provider | Fluent Alias | Default Model |
|----------|-------------|---------------|
| Anthropic | `claude` / `anthropic` | claude-sonnet-4-6 |
| OpenAI | `gpt` / `openai` | gpt-4o |
| Google | `gemini` / `google` | gemini-2.0-flash |
| Mistral | `mistral` | mistral-large-latest |
| Meta / Groq | `llama` / `groq` | llama-3.3-70b-versatile |
| DeepSeek | `deepseek` | deepseek-chat |
| xAI | `grok` | grok-3-mini |
| Perplexity | `perplexity` | sonar-pro |
| Any OpenAI-compatible | custom alias | your model |

Switch providers by changing one word. No code changes required.

---

## Setting API Keys

```bash
fluent env set ANTHROPIC_API_KEY=sk-ant-...
fluent env set OPENAI_API_KEY=sk-...
fluent env set GOOGLE_API_KEY=...
fluent env set GROQ_API_KEY=...
```

Keys are stored encrypted at `~/.fluent/credentials.json` and never appear in `.fl` source files.

> **Without keys:** FLUENT runs in mock mode — all `Ask` statements return a descriptive placeholder. All 36 tests pass with no keys.

---

## Examples

### Hello World
```bash
fluent run examples/hello.fl
```

### Sentiment Analysis Pipeline
```bash
fluent env set ANTHROPIC_API_KEY=sk-ant-...
fluent run examples/sentiment.fl
```

### Multi-Model Pipeline
```bash
fluent run examples/pipeline.fl
```

### HTTP API Server
```bash
fluent serve examples/api.fl --port 8080 --cors
curl -X POST http://localhost:8080/summarize \
  -H "Content-Type: application/json" \
  -d '{"text": "FLUENT is a natural language AI programming language."}'
```

### Cost Estimation
```bash
fluent estimate examples/pipeline.fl
#   Model                                In Tok   Out Tok  Est. Cost
#   ─────────────────────────────────────────────────────────────────
#   anthropic/claude-sonnet-4-6          20       512      $0.007740
#   anthropic/claude-sonnet-4-6          11       512      $0.007713
#   ─────────────────────────────────────────────────────────────────
#   TOTAL                                          1055     $0.015453
```

### Interactive REPL
```bash
fluent repl
fluent› Let x be 42.
fluent› Output x.
42
fluent› Ask claude to "what is 2 + 2?" and call the result answer.
fluent› Output answer.
...
fluent› .vars
fluent› .exit
```

---


---

## File Upload Support

FLUENT natively handles images, audio, video, and documents — both from disk
and via HTTP file uploads. No extra configuration needed.

### Loading Files in Programs

```fluent
-- Load an image from disk
Let photo be load image "report/chart.png".

-- Load a PDF or Word document (text is extracted automatically)
Let contract be read file "contracts/nda.pdf".
Let brief be read file "briefs/q1.docx".

-- Load audio for transcription
Let meeting be load audio "recordings/standup.mp3".

-- Load video (sent to Gemini or other multimodal models)
Let demo be load video "demos/walkthrough.mp4".
Let clip be load video "demo.mp4" sampled at 2 frames per second.
```

### Passing Files to Models

```fluent
-- Image → vision model
Ask claude to "describe everything visible in this chart" using image photo and call the result description.

-- Document → Q&A
Ask claude to "summarise the key obligations in this contract" using document contract and call the result summary.

-- Audio → transcription + analysis
Ask openai/gpt-4o to "transcribe this meeting" using audio meeting and call the result transcript.
Ask claude to "extract action items" using text transcript and call the result actions.

-- Multi-image comparison
Let before be load image "before.png".
Let after be load image "after.png".
Ask openai/gpt-4o to "describe what changed between these screenshots" using images before after and call the result diff.
```

### Supported File Types

| Kind | Extensions | Auto-extraction |
|------|-----------|-----------------|
| Image | jpg jpeg png gif webp bmp svg | Base64 → vision API |
| Audio | mp3 wav ogg flac m4a aac opus | Base64 → audio API |
| Video | mp4 mov avi mkv webm m4v | Base64 → Gemini / video API |
| Document | pdf docx doc txt md csv json xml html | Text extracted automatically |

Install optional extractors for PDF/DOCX:
```bash
npm install pdf-parse mammoth
```

### HTTP File Upload (`fluent serve`)

Every `fluent serve` deployment automatically gets a `/upload` endpoint and
accepts `multipart/form-data` on all routes:

```bash
fluent serve examples/multimodal-api.fl --port 8080 --cors
```

```bash
# Upload an image
curl -X POST http://localhost:8080/analyse-image \
  -F "image=@photo.jpg"

# Upload a document
curl -X POST http://localhost:8080/analyse-document \
  -F "document=@report.pdf"

# Upload audio
curl -X POST http://localhost:8080/transcribe \
  -F "audio=@meeting.mp3"

# Generic upload — runs the full program with the file in scope
curl -X POST http://localhost:8080/upload \
  -F "file=@anything.png"
```

**Accepted field names:** `file`, `files`, `image`, `images`, `audio`,
`video`, `document`, `documents`, `attachment`, `attachments`

**Max upload size:** 50 MB per file (memory-buffered, never written to disk)

## Running Tests

```bash
node bin/fluent.js test ./tests/

  FLUENT Test Runner

  ✓ test_hello.fl › declare and output a string
  ✓ test_hello.fl › arithmetic — addition
  ✓ test_hello.fl › while loop terminates
  ✓ test_hello.fl › for each iterates collection
  ✓ test_pipeline.fl › parallel for-each populates fields
  ✓ test_pipeline.fl › nested conditionals
  ✓ test_types.fl › number comparison operators
  ... (36 total)

  Tests:   36 passed, 0 failed, 36 total
```

---

## Embedding in Node.js

```javascript
const fluent = require('fluent-lang');

const { scope, trace } = await fluent.run(`
  Let topic be "AI safety".
  Ask claude to "summarise in one sentence" using text topic and call the result answer.
  Output answer.
`);

console.log(scope.answer);
console.log(trace.total_cost_usd);
```

---

## Language Specification

| Document | Contents |
|----------|---------|
| [`index.html`](./index.html) | Core spec — syntax, model binding, providers, control flow, pipelines, stdlib, examples |
| [`advanced.html`](./advanced.html) | Advanced — type system, streaming, guardrails, prompt patterns, database, event-driven, security, packages, formal grammar, roadmap |

---

## Repository Structure

```
fluent-lang/
├── bin/
│   └── fluent.js                  CLI entry point
├── src/
│   ├── parser/index.js            NL → AST parser
│   ├── executor/index.js          AST executor (async, scoped)
│   ├── providers/index.js         12 AI provider integrations (multimodal)
│   ├── runtime/
│   │   ├── env.js                 Encrypted credential vault
│   │   ├── tracer.js              Execution tracer + cost tracking
│   │   └── files.js               File loader (image/audio/video/document)
│   ├── cli/
│   │   ├── run.js                 fluent run
│   │   ├── test.js                fluent test
│   │   ├── serve.js               fluent serve (+ multer file upload)
│   │   ├── estimate.js            fluent estimate
│   │   └── repl.js                fluent repl
│   └── index.js                   Public Node.js embedding API
├── examples/
│   ├── hello.fl                   Hello World + arithmetic + functions
│   ├── sentiment.fl               Sentiment analysis loop
│   ├── pipeline.fl                Multi-model parallel pipeline
│   ├── api.fl                     HTTP API with @expose
│   ├── vision.fl                  Image analysis (Claude + GPT-4o + Gemini)
│   ├── document-qa.fl             PDF/DOCX Q&A pipeline
│   ├── audio-transcribe.fl        Whisper transcription + meeting intelligence
│   ├── multimodal-api.fl          HTTP API accepting file uploads
│   └── assets/                    Sample files for testing
├── tests/
│   ├── test_hello.fl              Core language tests (14)
│   ├── test_pipeline.fl           Pipeline + control flow tests (10)
│   ├── test_types.fl              Type system tests (12)
│   └── test_files.fl              File loading tests (8)  — 44 total ✓
├── assets/                        Logo and brand assets (5 SVG files)
├── .github/
│   ├── ISSUE_TEMPLATE/            Bug / feature / provider templates
│   ├── workflows/test.yml         CI matrix (Node 18 / 20 / 22)
│   └── workflows/publish.yml      npm publish on GitHub release
├── index.html                     Language spec Part I
├── advanced.html                  Language spec Part II
├── LICENSE                        MIT License
├── README.md                      This file
├── CONTRIBUTING.md                Contributor guide
├── CODE_OF_CONDUCT.md             Contributor Covenant v2.1
├── SECURITY.md                    Vulnerability reporting + safety guide
├── CHANGELOG.md                   Release notes
└── .fluentrc                      Runtime defaults
```

---

---

## Standard Library (No API Key Required)

FLUENT v1.1 ships with 100+ built-in functions across 7 categories — all execute locally without any model calls.

```fluent
-- String
Let upper    be the result of uppercase of name.
Let slug     be the result of slugify title.
Let words    be the result of split sentence by " ".
Let joined   be the result of join words with ", ".
Let short    be the result of truncate text to 80 characters.
Let n        be the result of the length of text.
Let wc       be the result of the word count of text.
Let replaced be the result of replace "old" with "new" in text.

-- Math
Let rounded  be the result of round score to 2 decimal places.
Let root     be the result of square root of area.
Let absval   be the result of absolute value of n.
Let rand     be the result of a random number between 1 and 100.

-- List
Let total    be the result of the sum of scores.
Let avg      be the result of the average of scores.
Let first    be the result of the first item of list.
Let unique   be the result of unique items from dupes.
Let nums     be the result of a range from 1 to 10.

-- Date
Let today    be the result of the current date.
Let tomorrow be the result of today plus 1 days.
Let diff     be the result of days between start and end.

-- Type conversion
Let n        be the result of raw_text converted to number.
Let s        be the result of score converted to text.

-- HTTP fetch
Fetch "https://api.example.com/data" and call the result response.
Post to "https://api.example.com/items" with body payload and call the result created.
```

---

## New Language Constructs (v1.1)

```fluent
-- Pattern Matching
Match status:
    When "active":   Output "Running.".
    When "error":    Output "Failed!".
    Otherwise:       Output "Unknown.".
End match.

-- Repeat
Repeat 5 times:
    Set count to count plus 1.
End repeat.

-- Unless
Unless user.verified is false:
    Output "Welcome, verified user.".
End unless.

-- Scoped Model Config
Using model claude with temperature 0:
    Ask claude to "classify this" using text input and call the result r.
End using.

-- Collection Pipelines
Filter employees where salary is greater than 90000 and call the result senior.
Map    employees to name                              and call the result names.
Sort   employees by salary descending                 and call the result ranked.
Group  employees by dept                              and call the result by_dept.
Reduce scores    to sum                               and call the result total.

-- Pipe
Pass input through uppercase, then through slugify and call the result slug.

-- Append to file / Emit event
Append log_entry to "run.log".
Emit "pipeline_done" with result.
```

---

## VSCode Extension

The `extension/` directory contains a full VSCode extension for `.fl` files.

**Features:** syntax highlighting · 25 snippets · run/estimate commands · outline view · hover docs · status bar

**Install (manual VSIX):**
```bash
cd extension
npm install -g vsce
vsce package
code --install-extension fluent-lang-1.2.0.vsix
```

**Snippets:** type `ask`, `match`, `foreach`, `pipeline`, `endpoint`, `test` and press Tab.

---

## Agent Loop

```fluent
@agent(model: claude, max_steps: 10)
@tools(read_file, write_file, run_calculation, web_search)
Run agent with goal "Analyse the sales data and write a report" and call the outcome result.

If result.success is true, then output result.answer.
```

Built-in tools: `read_file` · `write_file` · `list_files` · `run_calculation` · `http_get` · `web_search` · `remember` · `recall`

---

## Contributing

Contributions are very welcome — new providers, language features, examples,
bug fixes, and documentation improvements all matter.

1. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full guide
2. Check open [Issues](https://github.com/hvrcharon1/fluent-lang/issues) or open a new one
3. Fork → branch → PR against `main`

All contributors must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Community & Support

| Resource | Link |
|----------|------|
| 📖 Language Spec (Part I) | [`index.html`](./index.html) |
| 📖 Advanced Spec (Part II) | [`advanced.html`](./advanced.html) |
| 🐛 Bug Reports | [Issue Tracker](https://github.com/hvrcharon1/fluent-lang/issues) |
| 💡 Feature Requests | [Open an Issue](https://github.com/hvrcharon1/fluent-lang/issues/new?template=feature_request.md) |
| 🔌 Provider Requests | [Provider Issue Template](https://github.com/hvrcharon1/fluent-lang/issues/new?template=provider_request.md) |
| 🔒 Security Vulnerabilities | [`SECURITY.md`](./SECURITY.md) · [Private Advisory](https://github.com/hvrcharon1/fluent-lang/security/advisories/new) |
| 📜 Changelog | [`CHANGELOG.md`](./CHANGELOG.md) |

---

## Open Source

FLUENT is open source and built in the open. All contributions, issues, and
discussions are public on GitHub.

| File | Purpose |
|------|---------|
| [`LICENSE`](./LICENSE) | MIT License — free to use, modify, distribute |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | How to add providers, features, tests |
| [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) | Contributor Covenant v2.1 |
| [`SECURITY.md`](./SECURITY.md) | Responsible disclosure + safety guidance |
| [`.github/workflows/test.yml`](./.github/workflows/test.yml) | CI matrix — Node 18 / 20 / 22 |
| [`.github/workflows/publish.yml`](./.github/workflows/publish.yml) | Auto-publish to npm on release |

---

## License

```
MIT License

Copyright (c) 2026 Datacules LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

See [`LICENSE`](./LICENSE) for the full text.
