'use strict';
const readline = require('readline');
const chalk    = require('chalk');
const { parse }    = require('../parser');
const { Executor } = require('../executor');
const { T }        = require('../parser');
const { loadEnv }  = require('../runtime/env');

async function repl(opts = {}) {
  loadEnv();

  const executor = new Executor({});

  console.log(chalk.bold('  Welcome to the Fluent REPL'));
  console.log(chalk.dim('  Type Fluent statements and press Enter to execute.'));
  console.log(chalk.dim('  Multi-line: end a line with \\ to continue.'));
  console.log(chalk.dim('  Commands: .vars  .clear  .help  .exit\n'));

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let buffer = '';
  let continuation = false;

  const prompt = () => {
    const p = continuation
      ? chalk.dim('...  ')
      : chalk.cyan('fluent') + chalk.dim('› ') + ' ';
    rl.setPrompt(p);
    rl.prompt();
  };

  rl.on('line', async (line) => {
    rl.pause();

    // REPL meta-commands
    const trimmed = line.trim();
    if (!continuation) {
      if (trimmed === '.exit' || trimmed === '.quit') { console.log(chalk.dim('Goodbye.')); process.exit(0); }
      if (trimmed === '.clear') { executor.globalScope.vars = {}; console.log(chalk.dim('Scope cleared.')); prompt(); rl.resume(); return; }
      if (trimmed === '.vars') {
        const vars = executor.globalScope.vars;
        const keys = Object.keys(vars);
        if (!keys.length) { console.log(chalk.dim('  (no variables set)')); }
        else {
          for (const [k, v] of Object.entries(vars)) {
            const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
            console.log(`  ${chalk.yellow(k)} = ${chalk.dim(display.slice(0, 120))}`);
          }
        }
        prompt(); rl.resume(); return;
      }
      if (trimmed === '.help') {
        console.log(chalk.dim('\n  .vars    Show all variables in scope'));
        console.log(chalk.dim('  .clear   Clear the current scope'));
        console.log(chalk.dim('  .exit    Exit the REPL\n'));
        prompt(); rl.resume(); return;
      }
    }

    // Continuation
    if (line.endsWith('\\')) {
      buffer += line.slice(0, -1) + ' ';
      continuation = true;
      prompt(); rl.resume(); return;
    }

    buffer += line;
    const source = buffer.trim();
    buffer = '';
    continuation = false;

    if (!source) { prompt(); rl.resume(); return; }

    // Ensure source ends with '.' for parser
    const toparse = source.endsWith('.') ? source : source + '.';

    try {
      const ast = parse(toparse);
      for (const node of ast.body) {
        const result = await executor.exec(node, executor.globalScope);
        if (result !== undefined && result !== null && node.type !== T.OUTPUT) {
          if (typeof result === 'object') {
            console.log(chalk.dim('→ ') + JSON.stringify(result, null, 2).split('\n').map(l => '  ' + l).join('\n'));
          } else {
            console.log(chalk.dim('→ ') + chalk.white(String(result)));
          }
        }
      }
    } catch (err) {
      console.log(chalk.red(`✗ ${err.message}`));
    }

    prompt();
    rl.resume();
  });

  rl.on('close', () => { console.log(chalk.dim('\nGoodbye.')); process.exit(0); });

  prompt();
}

module.exports = { repl };
