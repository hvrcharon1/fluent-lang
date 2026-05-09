'use strict';
const fs    = require('fs');
const chalk = require('chalk');
const { parse }        = require('../parser');
const { T }            = require('../parser');
const { resolveModel, estimateTokens, estimateCost, PRICING } = require('../providers');

async function estimate(file, opts = {}) {
  if (!fs.existsSync(file)) {
    console.error(chalk.red(`✗ File not found: ${file}`));
    process.exit(1);
  }

  const source = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(source);
  } catch (err) {
    console.error(chalk.red(`✗ Parse error: ${err.message}`));
    process.exit(1);
  }

  const calls = [];
  collectCalls(ast.body, calls);

  if (!calls.length) {
    console.log(chalk.yellow('No model calls found in the program.'));
    return;
  }

  // Build estimate rows
  const rows = calls.map(c => {
    const resolved = resolveModel(c.model);
    const { provider, model } = resolved;
    const promptTokens = estimateTokens(c.instruction + (c.inputs || []).join(' '));
    const outputTokens = 512; // assumed default
    const cost = estimateCost(provider, model, promptTokens, outputTokens);
    return { provider, model, promptTokens, outputTokens, cost };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost.total, 0);
  const totalTokens = rows.reduce((s, r) => s + r.promptTokens + r.outputTokens, 0);

  if (opts.json) {
    console.log(JSON.stringify({ file, calls: rows, total_cost_usd: totalCost, total_tokens: totalTokens }, null, 2));
    return;
  }

  console.log(chalk.bold(`\n  FLUENT Cost Estimate — ${file}\n`));
  console.log(chalk.dim('  Note: Output token count assumed at 512 per call. Actual cost may vary.\n'));

  const colWidths = [35, 10, 10, 10];
  const header = ['Model', 'In Tok', 'Out Tok', 'Est. Cost'].map((h, i) => h.padEnd(colWidths[i])).join('  ');
  console.log(chalk.dim('  ' + header));
  console.log(chalk.dim('  ' + '─'.repeat(colWidths.reduce((s, w) => s + w + 2, 0))));

  for (const row of rows) {
    const modelKey = `${row.provider}/${row.model}`;
    const costStr  = row.cost.unknown ? chalk.dim('(unknown)') : chalk.yellow(`$${row.cost.total.toFixed(6)}`);
    const cols = [
      modelKey.slice(0, colWidths[0] - 1).padEnd(colWidths[0]),
      String(row.promptTokens).padEnd(colWidths[1]),
      String(row.outputTokens).padEnd(colWidths[2]),
      costStr,
    ];
    console.log('  ' + cols.join('  '));
  }

  console.log(chalk.dim('  ' + '─'.repeat(colWidths.reduce((s, w) => s + w + 2, 0))));
  console.log(`  ${'TOTAL'.padEnd(colWidths[0])}  ${String(totalTokens).padEnd(colWidths[1])}  ${' '.padEnd(colWidths[2])}  ${chalk.bold.yellow('$' + totalCost.toFixed(6))}`);
  console.log();
}

function collectCalls(nodes, out) {
  for (const node of nodes) {
    if (!node) continue;
    if (node.type === T.ASK) {
      out.push(node);
    }
    // Recurse into blocks
    for (const key of ['body', 'then', 'otherwise', 'fallbacks']) {
      if (!node[key]) continue;
      const children = Array.isArray(node[key]) ? node[key] : [node[key]];
      collectCalls(children, out);
    }
  }
}

module.exports = { estimate };
