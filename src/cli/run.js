'use strict';
const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const { parse }    = require('../parser');
const { Executor } = require('../executor');
const { loadEnv }  = require('../runtime/env');

async function run(file, opts = {}) {
  loadEnv();

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
    if (opts.verbose) console.error(err.stack);
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log(chalk.green(`✓ ${path.basename(file)} parsed successfully.`));
    console.log(chalk.dim(`  ${ast.body.length} top-level statement(s).`));
    return;
  }

  const executor = new Executor({ tracePath: opts.trace || null });

  console.log(chalk.dim(`Running ${chalk.bold(path.basename(file))}...\n`));

  try {
    await executor.run(ast);
  } catch (err) {
    if (err.name === 'FluentStop') {
      console.log(chalk.yellow(`\n⚑  Stopped: ${err.message}`));
    } else {
      console.error(chalk.red(`\n✗ Runtime error: ${err.message}`));
      if (opts.verbose) console.error(err.stack);
    }
    process.exit(1);
  }

  const report = executor.tracer.report();
  if (report.calls > 0) {
    console.log(chalk.dim(`\n─────────────────────────────────────────────`));
    console.log(chalk.dim(`  Model calls : ${report.calls}`));
    console.log(chalk.dim(`  Tokens used : ${report.total_tokens.toLocaleString()}`));
    console.log(chalk.dim(`  Est. cost   : $${report.total_cost_usd.toFixed(6)}`));
    console.log(chalk.dim(`  Elapsed     : ${report.elapsed_s}s`));
    console.log(chalk.dim(`─────────────────────────────────────────────`));
  }

  executor.tracer.save();
}

async function build(file, opts = {}) {
  loadEnv();
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

  const outDir = opts.out || './dist';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, path.basename(file, '.fl') + '.ast.json');
  fs.writeFileSync(outPath, JSON.stringify(ast, null, 2));
  console.log(chalk.green(`✓ Built: ${outPath}`));
}

module.exports = { run, build };
