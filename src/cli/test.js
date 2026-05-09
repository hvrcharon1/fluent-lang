'use strict';
const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const { parse }    = require('../parser');
const { Executor } = require('../executor');
const { T }        = require('../parser');
const { loadEnv }  = require('../runtime/env');

async function test(target, opts = {}) {
  loadEnv();

  // Collect test files
  const files = collectTestFiles(target);

  if (!files.length) {
    console.log(chalk.yellow(`No test files found in: ${target}`));
    return;
  }

  console.log(chalk.bold(`\n  FLUENT Test Runner\n`));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const results = await runTestFile(file, opts);
    for (const r of results) {
      if (r.status === 'pass') {
        totalPassed++;
        if (opts.reporter !== 'json') {
          console.log(`  ${chalk.green('✓')} ${chalk.dim(path.basename(file))} › ${r.name}`);
        }
      } else if (r.status === 'fail') {
        totalFailed++;
        if (opts.reporter !== 'json') {
          console.log(`  ${chalk.red('✗')} ${chalk.dim(path.basename(file))} › ${r.name}`);
          console.log(`    ${chalk.red(r.error)}`);
        }
      }
    }

    if (opts.reporter === 'json') {
      console.log(JSON.stringify({ file, results }, null, 2));
    }
  }

  // Summary
  const total = totalPassed + totalFailed;
  console.log('\n' + '─'.repeat(50));
  console.log(`  ${chalk.bold('Tests:')}   ${chalk.green(totalPassed + ' passed')}, ${totalFailed > 0 ? chalk.red(totalFailed + ' failed') : chalk.dim('0 failed')}, ${total} total`);

  if (totalFailed > 0) process.exit(1);
}

function collectTestFiles(target) {
  const files = [];
  if (fs.existsSync(target)) {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(target)) {
        if (f.endsWith('.fl')) files.push(path.join(target, f));
      }
    } else if (target.endsWith('.fl')) {
      files.push(target);
    }
  }
  return files;
}

async function runTestFile(file, opts = {}) {
  const source = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(source);
  } catch (err) {
    return [{ name: file, status: 'fail', error: `Parse error: ${err.message}` }];
  }

  const results = [];
  const testBlocks = ast.body.filter(n => n.type === T.TEST_BLOCK);

  // If no test blocks, run the whole file as a single test
  if (!testBlocks.length) {
    try {
      const executor = new Executor({});
      await executor.run(ast);
      results.push({ name: path.basename(file), status: 'pass' });
    } catch (err) {
      results.push({ name: path.basename(file), status: 'fail', error: err.message });
    }
    return results;
  }

  // Run each Test block individually
  for (const block of testBlocks) {
    if (opts.filter && !block.name.includes(opts.filter)) continue;
    try {
      const executor = new Executor({});
      // Build a mini-program with the test block's body
      const miniAst = { type: T.PROGRAM, body: block.body };
      await executor.run(miniAst);
      results.push({ name: block.name, status: 'pass' });
    } catch (err) {
      results.push({ name: block.name, status: 'fail', error: err.message });
    }
  }

  return results;
}

module.exports = { test };
