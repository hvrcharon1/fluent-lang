# Contributing to FLUENT

Thank you for your interest in FLUENT. This document covers everything you need to contribute to the language runtime, parser, provider registry, or documentation.

---

## Repository Structure

```
fluent-lang/
├── bin/
│   └── fluent.js           # CLI entry point (Commander.js)
├── src/
│   ├── parser/
│   │   └── index.js        # NL parser → AST
│   ├── executor/
│   │   └── index.js        # AST executor + Scope
│   ├── providers/
│   │   └── index.js        # Provider registry + API calls
│   ├── runtime/
│   │   ├── env.js           # Credential vault
│   │   └── tracer.js        # Execution tracer
│   ├── cli/
│   │   ├── run.js           # fluent run
│   │   ├── test.js          # fluent test
│   │   ├── serve.js         # fluent serve
│   │   ├── estimate.js      # fluent estimate
│   │   └── repl.js          # fluent repl
│   └── index.js             # Public Node.js API
├── examples/                # .fl program examples
├── tests/                   # .fl test files
├── index.html               # Language spec (Part I)
├── advanced.html            # Language spec (Part II)
├── .fluentrc                # Default runtime config
└── package.json
```

---

## Getting Started

```bash
git clone https://github.com/hvrcharon1/fluent-lang.git
cd fluent-lang
npm install
node bin/fluent.js --version
node bin/fluent.js run examples/hello.fl
node bin/fluent.js test ./tests/
```

---

## Adding a New Provider

1. Open `src/providers/index.js`
2. Add an alias entry to the `ALIASES` object:
   ```javascript
   myprovider: { provider: 'myprovider', model: 'my-model-name' },
   ```
3. Add pricing to the `PRICING` table (per 1M tokens, USD)
4. Add a `callMyProvider` function following the pattern of `callAnthropic`
5. Add a `case 'myprovider'` branch in `callProvider`
6. Set the API key env variable name in `.fluentrc`
7. Write a test in `tests/` that uses the provider with a mock

---

## Adding a New CLI Command

1. Add a `.command(...)` block in `bin/fluent.js`
2. Create `src/cli/<command>.js` exporting an async function
3. Wire it up in the bin

---

## Writing Tests

Test files are `.fl` programs in the `tests/` directory. Use `Test "name": ... End test.` blocks:

```fluent
Test "my new feature works":
    Let result be 42.
    Expect result to be greater than 41.
End test.
```

Run: `node bin/fluent.js test ./tests/`

Tests should **not** require API keys. Mock any AI output by structuring tests around deterministic logic.

---

## Coding Standards

- All source files: `'use strict';` at top
- Async functions for anything that may call an API
- Errors should be descriptive — include the failing variable name and value
- Comment every major code section with `// ── Name ──`
- Keep the parser purely functional (no side effects)
- Keep the executor stateless between runs (one `Executor` instance per run)

---

## Parser Contribution Notes

The parser in `src/parser/index.js` follows this pipeline:

```
Source → preprocess() → [groups] → parseGroups() → [AST nodes]
```

- `preprocess()` strips comments, collects annotations, groups continuation lines
- `parseGroups()` handles block statements (recursion for nested blocks)
- `parseStatement()` handles single-line statements
- `parseExpression()` and `parseCondition()` are pure functions

When adding a new statement type:
1. Add a constant to the `T` object
2. Add a regex match in `parseStatement()` or `parseGroups()` (for block forms)
3. Add an `exec` case in `src/executor/index.js`
4. Add at least one test

---

## Submitting a Pull Request

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes and run `node bin/fluent.js test ./tests/` (all 36 should pass)
4. Add tests for new behaviour
5. Update `CHANGELOG.md` under `[Unreleased]`
6. Open a PR with a clear description of what changed and why
