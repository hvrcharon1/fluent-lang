---
name: Bug Report
about: Report a runtime error, parse failure, or unexpected behaviour
title: "[BUG] "
labels: bug
assignees: ''
---

## Describe the Bug

A clear and concise description of what the bug is.

## Fluent Program That Triggers the Bug

```fluent
-- Paste the minimal .fl program that reproduces the issue
Let x be ...
Ask claude to "..." and call the result r.
```

## Expected Behaviour

What you expected to happen.

## Actual Behaviour

What actually happened. Include the full error message and stack trace if available.

```
fluent run my_program.fl
# paste output here
```

## Environment

- `fluent --version`:
- `node --version`:
- OS:
- Provider(s) used (Anthropic / OpenAI / Google / etc.):
- File type involved (image / audio / video / document / none):

## Additional Context

Any other context — screenshots, trace files (`fluent run --trace out.json`),
or links to related issues.
