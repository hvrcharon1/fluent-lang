# FLUENT Changelog

All notable changes to the FLUENT language runtime are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] — 2026-05-10 — Enhanced Programming Capabilities

### Added

#### Standard Library (`src/stdlib/index.js`) — 100+ built-in functions, no API calls needed

**String** — split, join, trim, upper, lower, capitalize, titleCase, replace, replaceAll,
length, wordCount, slice, first, last, includes, startsWith, endsWith, padStart, padEnd,
repeat, reverse, countOccurrences, matchPattern, extractNumbers, removeWhitespace,
collapseWhitespace, slugify, truncate, lines, template

**Math** — round, floor, ceil, abs, sqrt, cbrt, pow, log, log2, log10, min, max, clamp,
random, randomInt, sign, isEven, isOdd, percentage, add, subtract, multiply, divide,
modulo, PI, E, TAU

**List** — first, last, nth, count, sum, average, min, max, unique, reverse, flatten,
compact, chunk, zip, range, shuffle, sample, intersection, difference, union, includes,
indexOf, frequencies, pluck, groupBy, sortBy, sumBy, countBy, append, prepend, without,
take, drop

**Date** — now, today, parse, format, addDays, addHours, addMonths, diffDays, diffHours,
isBefore, isAfter, isSameDay, dayOfWeek, monthName, year, month, day, timestamp,
fromTimestamp

**JSON** — parse, stringify, get, set, keys, values, entries, merge, pick, omit, flatten,
isValid

**Type** — toNumber, toText, toBoolean, toList, typeOf, isNull, isNotNull, isEmpty,
isNumber, isText, isList, isRecord, coerce

**HTTP** — get, post, put, delete (async, returns `{status, ok, body}`)

#### 14 New Language Constructs (Parser + Executor)

**Match (Pattern Matching)**
```fluent
Match sentiment:
    When "positive": Output "Great!".
    When "negative": Output "Sorry.".
    Otherwise: Output "Neutral.".
End match.
```

**Repeat N Times**
```fluent
Repeat 5 times:
    Set count to count plus 1.
End repeat.
-- Exposes: iteration (1-based), index (0-based)
```

**Unless**
```fluent
Unless user.verified is false:
    Output "Welcome, verified user!".
End unless.
```

**Using Model (Scoped Config)**
```fluent
Using model claude with temperature 0:
    Ask claude to "classify this" using text input and call the result r.
End using.
```

**Filter**
```fluent
Filter employees where salary is greater than 90000 and call the result senior.
```

**Map**
```fluent
Map employees to name and call the result names.
```

**Sort**
```fluent
Sort employees by salary descending and call the result ranked.
```

**Group**
```fluent
Group employees by dept and call the result by_department.
```

**Reduce**
```fluent
Reduce scores to sum and call the result total.
-- Operations: sum, count, average, min, max, product
```

**Fetch**
```fluent
Fetch "https://api.example.com/data" and call the result response.
```

**Post**
```fluent
Post to "https://api.example.com/items" with body payload and call the result created.
```

**Pipe**
```fluent
Pass input through clean text, then through classify sentiment and call the result output.
```

**Append to File**
```fluent
Append log_entry to "run.log".
```

**Emit Event**
```fluent
Emit "pipeline_done" with result.
```

#### Natural Language Stdlib Expressions (in `Let x be the result of ...`)

```fluent
-- String
Let upper    be the result of uppercase of name.
Let lower    be the result of lowercase of name.
Let words    be the result of split sentence by " ".
Let joined   be the result of join words with ", ".
Let slug     be the result of slugify title.
Let n        be the result of the length of text.
Let wc       be the result of the word count of text.
Let short    be the result of truncate text to 80 characters.
Let prefix   be the result of the first 10 characters of text.
Let replaced be the result of replace "old" with "new" in text.

-- Math
Let rounded  be the result of round score to 2 decimal places.
Let floored  be the result of floor of n.
Let ceiled   be the result of ceiling of n.
Let absval   be the result of absolute value of n.
Let root     be the result of square root of area.
Let powered  be the result of base to the power of exp.
Let rand     be the result of a random number between 1 and 100.

-- List
Let total    be the result of the sum of scores.
Let avg      be the result of the average of scores.
Let first    be the result of the first item of list.
Let last     be the result of the last item of list.
Let unique   be the result of unique items from list.
Let nums     be the result of a range from 1 to 10.

-- Date
Let today    be the result of the current date.
Let tomorrow be the result of today plus 1 days.
Let diff     be the result of days between start and end.

-- Type
Let n        be the result of text_val converted to number.
Let s        be the result of num_val converted to text.

-- HTTP
Fetch "https://api.example.com" and call the result response.
```

#### Bug Fixes in Parser
- `parseRecord` rewritten with tokeniser — handles both `name "Alice" value 90`
  (space-delimited) and `name "Alice", value 90` (comma-delimited) field formats
- Match block: `When "x"` now correctly creates a `Literal` node, not an `Identifier`
- Match block: inline `When` clause (joined with Match header by preprocessor) now processed

#### Bug Fixes in Stdlib
- Trim guard tightened — `/^(\w+)\s+trimmed$/i` now checks `scope.get(m[1]) !== undefined`
  to prevent variables named `trimmed` triggering the trim handler for other expressions
- Reverse guard tightened — same approach for `reversed` suffix
- All broad `if (s.endsWith('trimmed'))` and `if (s.includes('reverse'))` conditions
  replaced with exact regex patterns

#### New Examples
- `examples/stdlib-demo.fl` — all stdlib categories end-to-end (no API key needed)
- `examples/pattern-matching.fl` — Match, Repeat, Unless, Using model, Append, Emit
- `examples/data-pipeline.fl` — AI + Filter/Sort/Group/Reduce/Map on a sales dataset
- `examples/http-integration.fl` — Fetch, type conversion, string/math/list pipelines

#### Tests
- `tests/test_stdlib.fl` — 37 new tests covering all new constructs and stdlib ops
- **Total: 81/81 tests passing**


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
