'use strict';
const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const { parse } = require('../parser');
const { T }     = require('../parser');

// ── Rule definitions ──────────────────────────────────────────────────────────
const RULES = [
  {
    id:   'no-hardcoded-key',
    desc: 'API keys should not appear in source files',
    check(nodes, src) {
      const issues = [];
      const lines  = src.split('\n');
      lines.forEach((line, i) => {
        if (/sk-ant-|sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}/.test(line) &&
            !line.trim().startsWith('--')) {
          issues.push({ line: i + 1, message: 'Possible API key in source. Use `fluent env set` instead.' });
        }
      });
      return issues;
    },
  },
  {
    id:   'no-unused-variable',
    desc: 'Variables declared but never used',
    check(nodes) {
      const declared = new Set();
      const used     = new Set();
      walkNodes(nodes, node => {
        if (node.type === T.DECLARATION) declared.add(node.name);
        if (node.type === T.ASSIGNMENT)  used.add(node.target?.split('.')[0]);
        if (node.type === T.IDENTIFIER)  used.add(node.name);
      });
      const unused = [...declared].filter(n => !used.has(n));
      return unused.map(n => ({ line: null, message: `Variable "${n}" is declared but never used.`, severity: 'hint' }));
    },
  },
  {
    id:   'ask-missing-result',
    desc: 'Ask statements should capture the result',
    check(nodes) {
      const issues = [];
      walkNodes(nodes, node => {
        if (node.type === T.ASK && !node.result) {
          issues.push({ line: null, message: `Ask statement has no "and call the result" clause — result will be discarded.` });
        }
      });
      return issues;
    },
  },
  {
    id:   'deep-nesting',
    desc: 'Deeply nested blocks reduce readability',
    check(nodes) {
      const issues = [];
      function walk(ns, depth) {
        for (const n of ns) {
          if (depth > 4) {
            issues.push({ line: null, message: `Block nesting depth ${depth} — consider extracting a function with "To ... End of".` });
            return;
          }
          const children = [n.body, n.then, n.otherwise, n.fallbacks].filter(Boolean).flat();
          if (children.length) walk(children, depth + 1);
        }
      }
      walk(nodes, 1);
      return issues;
    },
  },
  {
    id:   'prefer-typed-outputs',
    desc: 'Add @returns annotation to Ask statements in functions for type safety',
    check(nodes) {
      const issues = [];
      walkNodes(nodes, node => {
        if (node.type === T.FUNCTION_DEF) {
          node.body.forEach(child => {
            if (child.type === T.ASK && (!child.annotations || !child.annotations.some(a => a.name === 'returns'))) {
              issues.push({ line: null, message: `Consider adding @returns annotation to Ask inside function "${node.verb}".`, severity: 'hint' });
            }
          });
        }
      });
      return issues;
    },
  },
  {
    id:   'infinite-loop-risk',
    desc: 'While loops without a clear exit condition mutation',
    check(nodes) {
      const issues = [];
      walkNodes(nodes, node => {
        if (node.type === T.WHILE) {
          const hasSet = node.body.some(n => n.type === T.ASSIGNMENT);
          if (!hasSet) {
            issues.push({ line: null, message: 'While loop body has no Set statement — possible infinite loop.', severity: 'warning' });
          }
        }
      });
      return issues;
    },
  },
  {
    id:   'missing-error-handling',
    desc: 'Ask statements without try/fallback in serve-exposed functions',
    check(nodes) {
      const issues = [];
      walkNodes(nodes, node => {
        if (node.type === T.FUNCTION_DEF) {
          const isExposed = (node.annotations || []).some(a => a.name === 'expose');
          if (isExposed) {
            node.body.forEach(child => {
              if (child.type === T.ASK && child.annotations?.length === 0) {
                issues.push({ line: null, message: `Exposed function "${node.verb}" has an unguarded Ask — wrap with "Try to ... If that fails".`, severity: 'warning' });
              }
            });
          }
        }
      });
      return issues;
    },
  },
];

// ── Walk AST (deep — visits all nodes including expressions) ─────────────────
function walkNodes(nodes, fn) {
  if (!nodes) return;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    fn(node);
    // Walk all object/array values that might be child nodes
    for (const val of Object.values(node)) {
      if (!val) continue;
      if (Array.isArray(val)) {
        for (const child of val) {
          if (child && typeof child === 'object' && child.type) walkNodes([child], fn);
        }
      } else if (typeof val === 'object' && val.type) {
        walkNodes([val], fn);
      }
    }
  }
}

// ── Main lint entry point ──────────────────────────────────────────────────────
async function lint(target, opts = {}) {
  const files = collectFiles(target);
  if (!files.length) {
    console.log(chalk.yellow(`No .fl files found: ${target}`));
    return;
  }

  let totalErrors = 0, totalWarnings = 0, totalHints = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parse(src);
    } catch (e) {
      console.log(`${chalk.red('✗')} ${chalk.bold(path.relative(process.cwd(), file))}`);
      console.log(`  ${chalk.red('error')}  Parse failed: ${e.message}`);
      totalErrors++;
      continue;
    }

    const fileIssues = [];
    for (const rule of RULES) {
      try {
        const issues = rule.check(ast.body, src);
        for (const issue of issues) {
          fileIssues.push({ ...issue, ruleId: rule.id, severity: issue.severity || 'error' });
        }
      } catch (_) { /* rule threw — skip */ }
    }

    if (!fileIssues.length) {
      if (!opts.quiet) {
        console.log(`${chalk.green('✓')} ${chalk.dim(path.relative(process.cwd(), file))}`);
      }
      continue;
    }

    console.log(`${chalk.bold(path.relative(process.cwd(), file))}`);
    for (const issue of fileIssues) {
      const loc = issue.line ? chalk.dim(`:${issue.line}`) : '';
      const sev = issue.severity === 'warning' ? chalk.yellow('warn ')
                : issue.severity === 'hint'    ? chalk.blue('hint ')
                : chalk.red('error');
      console.log(`  ${loc}  ${sev}  ${issue.message}  ${chalk.dim(issue.ruleId)}`);
      if (issue.severity === 'warning') totalWarnings++;
      else if (issue.severity === 'hint') totalHints++;
      else totalErrors++;
    }
    console.log('');
  }

  // Summary
  const parts = [];
  if (totalErrors)   parts.push(chalk.red(`${totalErrors} error${totalErrors   !== 1 ? 's' : ''}`));
  if (totalWarnings) parts.push(chalk.yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`));
  if (totalHints)    parts.push(chalk.blue(`${totalHints} hint${totalHints     !== 1 ? 's' : ''}`));

  if (!parts.length) {
    console.log(chalk.green(`✓ ${files.length} file${files.length !== 1 ? 's' : ''} — no issues found.`));
  } else {
    console.log(`\n${parts.join(', ')} in ${files.length} file${files.length !== 1 ? 's' : ''}.`);
  }

  if (totalErrors > 0) process.exit(1);
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    return fs.readdirSync(target)
      .filter(f => f.endsWith('.fl'))
      .map(f => path.join(target, f));
  }
  return target.endsWith('.fl') ? [target] : [];
}

module.exports = { lint };
