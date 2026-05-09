#!/usr/bin/env node --no-deprecation
'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const pkg = require('../package.json');

// ── Banner ──────────────────────────────────────────────────────────────────
function banner() {
  console.log(chalk.bold('\n  ███████╗██╗     ██╗   ██╗███████╗███╗   ██╗████████╗'));
  console.log(chalk.bold('  ██╔════╝██║     ██║   ██║██╔════╝████╗  ██║╚══██╔══╝'));
  console.log(chalk.bold('  █████╗  ██║     ██║   ██║█████╗  ██╔██╗ ██║   ██║   '));
  console.log(chalk.bold('  ██╔══╝  ██║     ██║   ██║██╔══╝  ██║╚██╗██║   ██║   '));
  console.log(chalk.bold('  ██║     ███████╗╚██████╔╝███████╗██║ ╚████║   ██║   '));
  console.log(chalk.bold('  ╚═╝     ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   '));
  console.log(chalk.gray('  Natural Language AI Programming Language') + chalk.dim(` v${pkg.version}\n`));
}

program
  .name('fluent')
  .version(pkg.version)
  .description('FLUENT — Natural Language AI Programming Language');

// ── fluent run <file> ───────────────────────────────────────────────────────
program
  .command('run <file>')
  .description('Run a Fluent program (.fl)')
  .option('--env <environment>', 'Environment name (default: development)', 'development')
  .option('--trace <path>', 'Write execution trace to JSON file')
  .option('--replay <path>', 'Replay from a cached trace (no API calls)')
  .option('--dry-run', 'Parse and validate only, do not execute')
  .option('--no-color', 'Disable colored output')
  .action(async (file, opts) => {
    const { run } = require('../src/cli/run');
    await run(file, opts);
  });

// ── fluent test <dir|file> ──────────────────────────────────────────────────
program
  .command('test [target]')
  .description('Run Fluent test files')
  .option('--watch', 'Re-run tests on file changes')
  .option('--filter <pattern>', 'Only run tests matching pattern')
  .option('--reporter <type>', 'Output format: pretty | json | tap', 'pretty')
  .action(async (target = './tests/', opts) => {
    const { test } = require('../src/cli/test');
    await test(target, opts);
  });

// ── fluent serve <file> ─────────────────────────────────────────────────────
program
  .command('serve <file>')
  .description('Expose a Fluent program as an HTTP API')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('--host <host>', 'Host to bind to', '0.0.0.0')
  .option('--cors', 'Enable CORS headers')
  .option('--auth <token>', 'Require Bearer token for all requests')
  .action(async (file, opts) => {
    const { serve } = require('../src/cli/serve');
    await serve(file, opts);
  });

// ── fluent estimate <file> ──────────────────────────────────────────────────
program
  .command('estimate <file>')
  .description('Estimate API cost before running a program')
  .option('--json', 'Output estimate as JSON')
  .action(async (file, opts) => {
    const { estimate } = require('../src/cli/estimate');
    await estimate(file, opts);
  });

// ── fluent repl ─────────────────────────────────────────────────────────────
program
  .command('repl')
  .description('Start an interactive Fluent REPL')
  .option('--model <model>', 'Default model alias', 'claude')
  .action(async (opts) => {
    banner();
    const { repl } = require('../src/cli/repl');
    await repl(opts);
  });

// ── fluent env ──────────────────────────────────────────────────────────────
program
  .command('env')
  .description('Manage provider credentials')
  .addCommand(
    (() => {
      const { Command } = require('commander');
      const sub = new Command('set').argument('<key=value>', 'Set a credential').action((kv) => {
        const [k, v] = kv.split('=');
        const { envSet } = require('../src/runtime/env');
        envSet(k, v);
      });
      return sub;
    })()
  )
  .addCommand(
    (() => {
      const { Command } = require('commander');
      return new Command('list').description('List configured credentials').action(() => {
        const { envList } = require('../src/runtime/env');
        envList();
      });
    })()
  );

// ── fluent build <file> ─────────────────────────────────────────────────────
program
  .command('build <file>')
  .description('Validate and bundle a Fluent program')
  .option('--out <dir>', 'Output directory', './dist')
  .action(async (file, opts) => {
    const { build } = require('../src/cli/run');
    await build(file, opts);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  banner();
  program.outputHelp();
}
