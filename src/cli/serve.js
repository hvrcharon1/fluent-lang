'use strict';
const fs      = require('fs');
const path    = require('path');
const chalk   = require('chalk');
const express = require('express');
const { parse }    = require('../parser');
const { Executor } = require('../executor');
const { T }        = require('../parser');
const { loadEnv }  = require('../runtime/env');

async function serve(file, opts = {}) {
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

  const app  = express();
  const port = parseInt(opts.port) || 8080;
  const host = opts.host || '0.0.0.0';

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (opts.cors) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  if (opts.auth) {
    app.use((req, res, next) => {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token !== opts.auth) return res.status(401).json({ error: 'Unauthorized' });
      next();
    });
  }

  // ── Discover @expose annotated functions ─────────────────────────────────
  const routes = discoverRoutes(ast);

  if (!routes.length) {
    // No @expose annotations — expose the whole program as POST /run
    routes.push({ method: 'POST', path: '/run', node: null, name: 'program' });
  }

  for (const route of routes) {
    const method = (route.method || 'POST').toLowerCase();
    app[method](route.path, async (req, res) => {
      const body = { ...req.query, ...req.body };
      try {
        const executor = new Executor({});
        // Pre-populate scope with request body
        for (const [k, v] of Object.entries(body)) {
          executor.globalScope.set(k, v);
        }
        executor.globalScope.set('request_body', body);
        executor.globalScope.set('request_headers', req.headers);

        let result;
        if (route.node) {
          // Execute only this function's body
          const miniAst = { type: T.PROGRAM, body: route.node.body };
          await executor.run(miniAst);
          result = executor.globalScope.get('__last_output__') || { status: 'ok' };
        } else {
          await executor.run(ast);
          result = { status: 'ok' };
        }

        const report = executor.tracer.report();
        res.json({
          result,
          meta: { calls: report.calls, tokens: report.total_tokens, cost_usd: report.total_cost_usd }
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    console.log(chalk.dim(`  ${route.method.toUpperCase().padEnd(6)} ${chalk.cyan(route.path)}  → ${route.name}`));
  }

  // ── Health check ────────────────────────────────────────────────────────
  app.get('/health', (req, res) => res.json({ status: 'ok', file: path.basename(file) }));

  app.listen(port, host, () => {
    console.log(chalk.bold(`\n  FLUENT API Server\n`));
    console.log(`  ${chalk.green('●')} Running on ${chalk.cyan(`http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)}`);
    console.log(`  ${chalk.green('●')} File: ${chalk.bold(path.basename(file))}`);
    console.log(`  ${chalk.green('●')} Routes: ${routes.length}`);
    console.log(chalk.dim(`\n  Press Ctrl+C to stop\n`));
  });
}

function discoverRoutes(ast) {
  const routes = [];
  for (const node of ast.body) {
    if (node.type !== T.FUNCTION_DEF) continue;
    const exposeAnn = (node.annotations || []).find(a => a.name === 'expose');
    if (!exposeAnn) continue;
    routes.push({
      method: exposeAnn.args.method || 'POST',
      path:   exposeAnn.args.path   || `/${node.verb.replace(/\s+/g, '-').toLowerCase()}`,
      node,
      name: node.verb,
    });
  }
  return routes;
}

module.exports = { serve };
