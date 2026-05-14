'use strict';
const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');

// ── fluent trace view <file> ──────────────────────────────────────────────────
function traceView(traceFile) {
  const data = loadTrace(traceFile);
  if (!data) return;

  console.log(chalk.bold(`\n  FLUENT Trace — ${path.basename(traceFile)}\n`));
  console.log(chalk.dim(`  Program calls : ${data.calls}`));
  console.log(chalk.dim(`  Total tokens  : ${(data.total_tokens || 0).toLocaleString()}`));
  console.log(chalk.dim(`  Total cost    : $${(data.total_cost_usd || 0).toFixed(6)}`));
  console.log(chalk.dim(`  Elapsed       : ${data.elapsed_s}s`));
  console.log('');

  if (!data.entries || !data.entries.length) {
    console.log(chalk.dim('  (no model calls recorded)'));
    return;
  }

  const colW = [6, 40, 30, 9, 10, 10, 12];
  const header = ['Step', 'Instruction', 'Model', 'In Tok', 'Out Tok', 'ms', 'Cost USD']
    .map((h, i) => h.padEnd(colW[i])).join('  ');
  console.log(chalk.dim('  ' + header));
  console.log(chalk.dim('  ' + '─'.repeat(colW.reduce((s, w) => s + w + 2, 0))));

  for (const e of data.entries) {
    if (e.type === 'error') {
      console.log(`  ${chalk.red('ERR')}  ${chalk.red(e.error || 'unknown error')}`);
      continue;
    }
    const instr = (e.instruction || '').slice(0, colW[1] - 1).padEnd(colW[1]);
    const model = (e.model || '').slice(0, colW[2] - 1).padEnd(colW[2]);
    const inTok  = String(e.input_tokens  || 0).padEnd(colW[3]);
    const outTok = String(e.output_tokens || 0).padEnd(colW[4]);
    const ms     = String(e.latency_ms    || 0).padEnd(colW[5]);
    const cost   = e.cost_usd != null
      ? chalk.yellow(`$${e.cost_usd.toFixed(6)}`)
      : chalk.dim('(unknown)');
    console.log(`  ${String(e.step).padEnd(colW[0])}  ${instr}  ${chalk.dim(model)}  ${inTok}  ${outTok}  ${ms}  ${cost}`);
  }
  console.log('');
}

// ── fluent trace cost <file> ──────────────────────────────────────────────────
function traceCost(traceFile) {
  const data = loadTrace(traceFile);
  if (!data) return;

  const byModel = {};
  for (const e of (data.entries || [])) {
    if (e.type === 'error' || !e.model) continue;
    if (!byModel[e.model]) byModel[e.model] = { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0 };
    byModel[e.model].calls         += 1;
    byModel[e.model].input_tokens  += e.input_tokens  || 0;
    byModel[e.model].output_tokens += e.output_tokens || 0;
    byModel[e.model].cost          += e.cost_usd      || 0;
  }

  console.log(chalk.bold(`\n  FLUENT Cost Report — ${path.basename(traceFile)}\n`));

  const colW = [40, 8, 10, 12, 12];
  const header = ['Model', 'Calls', 'In Tok', 'Out Tok', 'Cost USD']
    .map((h, i) => h.padEnd(colW[i])).join('  ');
  console.log(chalk.dim('  ' + header));
  console.log(chalk.dim('  ┌' + '─'.repeat(colW.reduce((s, w) => s + w + 2, 0)) + '┐'));

  let totalCost = 0;
  let totalTokens = 0;
  for (const [model, stats] of Object.entries(byModel)) {
    const m = model.slice(0, colW[0] - 1).padEnd(colW[0]);
    const c = String(stats.calls).padEnd(colW[1]);
    const i = String(stats.input_tokens).padEnd(colW[2]);
    const o = String(stats.output_tokens).padEnd(colW[3]);
    const cost = chalk.yellow(`$${stats.cost.toFixed(6)}`);
    console.log(`  │ ${m}  ${c}  ${i}  ${o}  ${cost}`);
    totalCost   += stats.cost;
    totalTokens += stats.input_tokens + stats.output_tokens;
  }

  console.log(chalk.dim('  └' + '─'.repeat(colW.reduce((s, w) => s + w + 2, 0)) + '┘'));
  console.log(`  ${'TOTAL'.padEnd(colW[0])}  ${String(data.calls).padEnd(colW[1])}  ` +
    `${String(totalTokens).padEnd(colW[2])}  ${' '.padEnd(colW[3])}  ${chalk.bold.yellow('$' + totalCost.toFixed(6))}`);
  console.log('');
}

// ── fluent trace diff <file1> <file2> ─────────────────────────────────────────
function traceDiff(file1, file2) {
  const a = loadTrace(file1);
  const b = loadTrace(file2);
  if (!a || !b) return;

  console.log(chalk.bold(`\n  FLUENT Semantic Diff\n`));
  console.log(`  ${chalk.dim('A:')} ${path.basename(file1)}`);
  console.log(`  ${chalk.dim('B:')} ${path.basename(file2)}\n`);

  const aEntries = (a.entries || []).filter(e => e.type !== 'error');
  const bEntries = (b.entries || []).filter(e => e.type !== 'error');
  const maxLen   = Math.max(aEntries.length, bEntries.length);

  let different = 0;
  for (let i = 0; i < maxLen; i++) {
    const ae = aEntries[i];
    const be = bEntries[i];
    if (!ae && be) {
      console.log(`  ${chalk.yellow('+')} Step ${i + 1} (only in B): ${(be.instruction || '').slice(0, 60)}`);
      different++;
    } else if (ae && !be) {
      console.log(`  ${chalk.red('-')} Step ${i + 1} (only in A): ${(ae.instruction || '').slice(0, 60)}`);
      different++;
    } else if (ae && be) {
      // Compare models
      if (ae.model !== be.model) {
        console.log(`  ${chalk.yellow('~')} Step ${i + 1} model changed: ${chalk.dim(ae.model)} → ${chalk.cyan(be.model)}`);
      }
      // Compare instruction
      if ((ae.instruction || '').slice(0, 80) !== (be.instruction || '').slice(0, 80)) {
        console.log(`  ${chalk.yellow('~')} Step ${i + 1} instruction changed`);
        console.log(`    ${chalk.dim('A:')} ${(ae.instruction || '').slice(0, 70)}`);
        console.log(`    ${chalk.cyan('B:')} ${(be.instruction || '').slice(0, 70)}`);
        different++;
      } else {
        // Compare cost
        const costDiff = ((be.cost_usd || 0) - (ae.cost_usd || 0));
        const sign     = costDiff > 0 ? chalk.red('+') : chalk.green('');
        if (Math.abs(costDiff) > 0.000001) {
          console.log(`  ${chalk.dim('≈')} Step ${i + 1} cost: A=$${(ae.cost_usd||0).toFixed(6)} B=$${(be.cost_usd||0).toFixed(6)} (${sign}$${Math.abs(costDiff).toFixed(6)})`);
        } else {
          console.log(`  ${chalk.green('✓')} Step ${i + 1} identical: ${(ae.instruction || '').slice(0, 60)}`);
        }
      }
    }
  }

  console.log('');
  const totalDiff = (b.total_cost_usd || 0) - (a.total_cost_usd || 0);
  console.log(`  Cost A: $${(a.total_cost_usd||0).toFixed(6)}  →  Cost B: $${(b.total_cost_usd||0).toFixed(6)}  ` +
    `(${totalDiff >= 0 ? chalk.red('+') : chalk.green('')}$${Math.abs(totalDiff).toFixed(6)})`);
  console.log(`  ${different} difference(s) found.\n`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadTrace(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`✗ Trace file not found: ${filePath}`));
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(chalk.red(`✗ Invalid trace file: ${e.message}`));
    return null;
  }
}

module.exports = { traceView, traceCost, traceDiff };
