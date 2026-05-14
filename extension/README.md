# FLUENT Language — VSCode Extension

Syntax highlighting, code snippets, run/estimate commands, and hover docs for the
[FLUENT Natural Language AI Programming Language](https://github.com/hvrcharon1/fluent-lang).

---

## Features

- **Syntax highlighting** for all FLUENT keywords, model references, annotations, strings, and stdlib functions
- **25 code snippets** — type `ask`, `match`, `foreach`, `pipeline`, `endpoint`, and more
- **Run command** — `Ctrl+Shift+P → FLUENT: Run This Program` (or click ▶ in the title bar)
- **Cost estimate** — `FLUENT: Estimate API Cost` before you run
- **Dry-run validation** — `FLUENT: Validate (Dry Run)` to parse without executing
- **Outline view** — see all functions, test blocks, and model aliases in the Explorer
- **Hover docs** — hover over `claude`, `Ask`, `Filter`, `Match`, etc. for inline docs
- **Status bar** — shows FLUENT status for active `.fl` files
- **Auto-indentation** — `:` opens a block, `End ...` closes it
- **Bracket matching** — `(`, `)`, `"` auto-close

---

## Requirements

Install the FLUENT runtime:

```bash
npm install -g fluent-lang
```

Set your API credentials:

```bash
fluent env set ANTHROPIC_API_KEY=sk-ant-...
fluent env set OPENAI_API_KEY=sk-...
```

---

## Quick Start

1. Create a file called `hello.fl`
2. Type `ask` and press Tab for the Ask snippet
3. Press `Ctrl+Shift+P` → **FLUENT: Run This Program**

```fluent
-- hello.fl
Let greeting be "Hello from FLUENT!".
Output greeting.

Ask claude to "explain what FLUENT is in one sentence" and call the result explanation.
Output explanation.
```

---

## Snippets

| Prefix       | Expands to                            |
|--------------|---------------------------------------|
| `let`        | `Let name be value.`                  |
| `ask`        | Full `Ask model to "..." ...` call    |
| `askm`       | Ask with `@model(...)` annotation     |
| `if`         | `If / Otherwise` conditional          |
| `match`      | Full `Match / When / Otherwise` block |
| `foreach`    | `For each item in collection` loop    |
| `parallel`   | Parallel for-each loop                |
| `repeat`     | `Repeat N times` block                |
| `while`      | `While condition` loop                |
| `unless`     | `Unless condition` block              |
| `to`         | Function definition                   |
| `try`        | `Try to / If that fails` block        |
| `defmodel`   | `Define model alias`                  |
| `usingmodel` | `Using model ... End using` block     |
| `filter`     | Filter collection                     |
| `map`        | Map collection to field               |
| `sort`       | Sort collection by field              |
| `group`      | Group collection by field             |
| `reduce`     | Reduce collection to scalar           |
| `fetch`      | HTTP GET request                      |
| `post`       | HTTP POST request                     |
| `test`       | Test block                            |
| `expect`     | Expect assertion                      |
| `pipeline`   | Full pipeline skeleton                |
| `endpoint`   | HTTP API endpoint with `@expose`      |

---

## Extension Settings

| Setting                   | Default   | Description                                      |
|---------------------------|-----------|--------------------------------------------------|
| `fluent.executablePath`   | `fluent`  | Path to the fluent CLI                           |
| `fluent.defaultModel`     | `claude`  | Default model for new programs                   |
| `fluent.showCostOnSave`   | `false`   | Show cost estimate in status bar on save         |

---

## Supported Providers

`claude` · `gpt` · `gemini` · `mistral` · `llama` · `groq` · `deepseek` · `grok` · `perplexity`

---

## License

MIT — Datacules LLC, 2026
