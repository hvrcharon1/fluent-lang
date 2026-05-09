# Pull Request

## What does this PR do?

<!-- A clear, one-paragraph description of the change. -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing behaviour to change)
- [ ] New provider integration
- [ ] Documentation / example update
- [ ] Refactor / performance improvement
- [ ] CI / tooling change

## Related Issue

Closes #<!-- issue number -->

## Changes Made

<!-- List the files changed and what was done to each. -->

- `src/parser/index.js` — added X support
- `src/providers/index.js` — wired Y provider
- `examples/z.fl` — new example demonstrating the feature

## Fluent Syntax Change (if any)

```fluent
-- Before (old syntax or N/A)
...

-- After (new syntax)
...
```

## Tests

- [ ] All existing tests pass: `node bin/fluent.js test ./tests/` (all N/N ✓)
- [ ] New tests added for new behaviour
- [ ] Test coverage includes error/edge cases
- [ ] No API keys required for the new tests

## Checklist

- [ ] Code follows the `'use strict'` convention and is commented
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `CONTRIBUTING.md` updated if the contribution guide needs to change
- [ ] New provider added to the provider table in `README.md`
- [ ] No API keys or secrets in any committed file

## Screenshots / Output

<!-- If the change affects CLI output or serve responses, paste a sample here. -->

```
$ fluent run examples/my_example.fl
...
```
