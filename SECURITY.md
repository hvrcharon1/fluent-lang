# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | ✅ Active support  |
| < 1.0   | ❌ Not supported   |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in FLUENT, please report it
responsibly by opening a
[GitHub Security Advisory](https://github.com/hvrcharon1/fluent-lang/security/advisories/new)
on this repository. This keeps the details private until a fix is ready.

Alternatively, describe the vulnerability in a private message to the
maintainers via GitHub.

### What to include

A good vulnerability report includes:

- A description of the vulnerability and its potential impact
- Step-by-step instructions to reproduce the issue
- The version of `fluent-lang` you were using (`fluent --version`)
- Your Node.js version (`node --version`)
- Any relevant code samples or proof-of-concept

### What to expect

- **Acknowledgement** within 48 hours of receipt
- **Status update** within 7 days — confirmed, needs more info, or not a
  vulnerability
- **Fix + advisory** published within 30 days for confirmed issues
- You will be credited in the advisory unless you prefer anonymity

---

## Security Considerations for FLUENT Programs

### API Credentials

FLUENT stores provider credentials in `~/.fluent/credentials.json` with file
permissions set to `0600` (owner-readable only). Never commit this file.

```bash
# Good — load from environment
fluent env set ANTHROPIC_API_KEY=sk-ant-...

# Never do this in .fl source files
Let key be "sk-ant-...".   # ← credentials must NOT appear in .fl files
```

### Prompt Injection

When passing user-controlled input to model `Ask` statements, use the `using`
clause — **never** concatenate user data directly into the instruction string:

```fluent
-- ✅ Safe: instruction and data are structurally separated
Ask claude to "classify this message" using text user_input and call the result r.

-- ❌ Unsafe: do not interpolate user data into the instruction
-- (The parser will reject this at parse time, but avoid the pattern entirely.)
```

### File Uploads in fluent serve

When using `fluent serve` with file upload endpoints:

- Uploaded files are held in memory only and never written to disk
- Maximum upload size is 50 MB per file by default (configurable via `multer`)
- Always validate file types in your `.fl` handlers before passing to model calls
- Use `--auth <token>` to protect all endpoints in production

```bash
# Production-safe serve command
fluent serve api.fl --port 8080 --cors --auth "$(openssl rand -hex 32)"
```

### The `run_python` / `run_node` Tool

If your program grants an agent access to code-execution tools, ensure the
agent's model is from a trusted provider and that you use
`@require_approval_before(run_python)` for any sensitive operations.

---

## Dependency Security

FLUENT's dependencies are audited regularly. To check for known vulnerabilities
in your local install:

```bash
cd fluent-lang
npm audit
```

To update to the latest patched versions:

```bash
npm update
npm audit fix
```
