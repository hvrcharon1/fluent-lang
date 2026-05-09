'use strict';
const fs      = require('fs');
const path    = require('path');
const chalk   = require('chalk');
const express = require('express');
const multer  = require('multer');
const { parse }         = require('../parser');
const { Executor }      = require('../executor');
const { T }             = require('../parser');
const { loadEnv }       = require('../runtime/env');
const { loadFromBuffer, detectKind } = require('../runtime/files');

// ── multer: store uploads in memory (< 50 MB) ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },   // 50 MB per file
});

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

  // ── JSON + URL-encoded body ────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  if (opts.cors) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With');
      res.header('Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (opts.auth) {
    app.use((req, res, next) => {
      if (req.path === '/health') return next();   // health is always public
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (token !== opts.auth) return res.status(401).json({ error: 'Unauthorized' });
      next();
    });
  }

  // ── Discover @expose annotated functions ──────────────────────────────────
  const routes = discoverRoutes(ast);
  if (!routes.length) {
    routes.push({ method: 'POST', path: '/run', node: null, name: 'program' });
  }

  // ── Mount each route (with optional file upload) ──────────────────────────
  for (const route of routes) {
    const method = (route.method || 'POST').toLowerCase();

    // Use multer for any route that accepts files; fields named file, image,
    // audio, video, document, attachment (or plural)
    const fileFields = [
      { name: 'file',        maxCount: 10 },
      { name: 'files',       maxCount: 10 },
      { name: 'image',       maxCount: 10 },
      { name: 'images',      maxCount: 10 },
      { name: 'audio',       maxCount: 5  },
      { name: 'video',       maxCount: 5  },
      { name: 'document',    maxCount: 10 },
      { name: 'documents',   maxCount: 10 },
      { name: 'attachment',  maxCount: 10 },
      { name: 'attachments', maxCount: 10 },
    ];

    app[method](
      route.path,
      upload.fields(fileFields),
      async (req, res) => {
        const body = { ...req.query, ...req.body };

        try {
          // ── Build scope from JSON body ─────────────────────────────────
          const executor = new Executor({});
          for (const [k, v] of Object.entries(body)) {
            try { executor.globalScope.set(k, JSON.parse(v)); }
            catch { executor.globalScope.set(k, v); }
          }
          executor.globalScope.set('request_body',    body);
          executor.globalScope.set('request_headers', req.headers);

          // ── Load uploaded files into scope ─────────────────────────────
          if (req.files) {
            const uploadedFiles = {};
            for (const [fieldName, fileArray] of Object.entries(req.files)) {
              const loaded = await Promise.all(fileArray.map(f =>
                loadFromBuffer(f.buffer, f.originalname, f.mimetype)
              ));
              const val = loaded.length === 1 ? loaded[0] : loaded;
              uploadedFiles[fieldName] = val;
              executor.globalScope.set(fieldName, val);
              // Also set as the canonical kind name (image, audio, etc.)
              const kind = detectKind(fileArray[0].originalname);
              if (!executor.globalScope.get(kind)) {
                executor.globalScope.set(kind, val);
              }
            }
            executor.globalScope.set('uploaded_files', uploadedFiles);
          }

          // ── Execute ────────────────────────────────────────────────────
          if (route.node) {
            const miniAst = { type: T.PROGRAM, body: route.node.body };
            await executor.run(miniAst);
          } else {
            await executor.run(ast);
          }

          // Gather any variables set during execution as result
          const vars = executor.globalScope.vars;
          const report = executor.tracer.report();

          res.json({
            result: vars.__result__ || vars.result || vars.output || { status: 'ok' },
            scope:  sanitiseScope(vars),
            meta: {
              calls:     report.calls,
              tokens:    report.total_tokens,
              cost_usd:  report.total_cost_usd,
              elapsed_s: report.elapsed_s,
            },
          });
        } catch (err) {
          console.error(chalk.red(`  ✗ ${req.method} ${req.path}: ${err.message}`));
          res.status(500).json({ error: err.message });
        }
      }
    );

    const uploadHint = route.acceptsFiles ? chalk.dim(' (multipart/form-data ✓)') : '';
    console.log(
      `  ${chalk.dim(route.method.toUpperCase().padEnd(6))} ${chalk.cyan(route.path)}` +
      `  → ${chalk.bold(route.name)}${uploadHint}`
    );
  }

  // ── Generic file-upload endpoint ─────────────────────────────────────────
  // POST /upload — receive files, run the full program with them in scope
  app.post('/upload', upload.fields([
    { name: 'file',        maxCount: 20 },
    { name: 'files',       maxCount: 20 },
    { name: 'image',       maxCount: 10 },
    { name: 'audio',       maxCount: 5  },
    { name: 'video',       maxCount: 5  },
    { name: 'document',    maxCount: 10 },
    { name: 'attachment',  maxCount: 20 },
  ]), async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Use multipart/form-data.' });
    }
    try {
      const executor = new Executor({});
      for (const [k, v] of Object.entries({ ...req.query, ...req.body })) {
        executor.globalScope.set(k, v);
      }
      // Load each uploaded file
      const results = {};
      for (const [fieldName, fileArray] of Object.entries(req.files)) {
        const loaded = await Promise.all(fileArray.map(f =>
          loadFromBuffer(f.buffer, f.originalname, f.mimetype)
        ));
        const val = loaded.length === 1 ? loaded[0] : loaded;
        results[fieldName] = val;
        executor.globalScope.set(fieldName, val);
        executor.globalScope.set(detectKind(fileArray[0].originalname), val);
      }
      // Run the full program
      await executor.run(ast);
      const vars   = executor.globalScope.vars;
      const report = executor.tracer.report();
      res.json({
        uploaded: Object.fromEntries(
          Object.entries(results).map(([k,v]) => [k, summariseFile(v)])
        ),
        result: vars.__result__ || vars.result || vars.output || { status: 'ok' },
        scope:  sanitiseScope(vars),
        meta: {
          calls: report.calls, tokens: report.total_tokens,
          cost_usd: report.total_cost_usd,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  console.log(`  ${chalk.dim('POST  ')} ${chalk.cyan('/upload')}         → generic file upload`);

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (req, res) => res.json({
    status: 'ok', file: path.basename(file), routes: routes.length + 1,
  }));

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use((req, res) => res.status(404).json({
    error: 'Not found',
    available: routes.map(r => `${r.method.toUpperCase()} ${r.path}`)
      .concat(['POST /upload', 'GET /health']),
  }));

  app.listen(port, host, () => {
    console.log(chalk.bold(`\n  FLUENT API Server\n`));
    console.log(`  ${chalk.green('●')} Running on  ${chalk.cyan(`http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`)}`);
    console.log(`  ${chalk.green('●')} Program     ${chalk.bold(path.basename(file))}`);
    console.log(`  ${chalk.green('●')} Routes      ${routes.length + 1} endpoints`);
    console.log(`  ${chalk.green('●')} File upload ${chalk.dim('POST /upload  (multipart/form-data, max 50 MB)')}`);
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
      name:   node.verb,
    });
  }
  return routes;
}

function sanitiseScope(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) {
    if (k.startsWith('__')) continue;
    // Don't send full base64 payloads back in scope
    if (v && typeof v === 'object' && v.base64) {
      out[k] = summariseFile(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function summariseFile(f) {
  if (!f || typeof f !== 'object') return f;
  if (Array.isArray(f)) return f.map(summariseFile);
  return {
    type: f.type, filename: f.filename, mimeType: f.mimeType,
    size: f.size, text: f.text ? f.text.slice(0, 200) + (f.text.length > 200 ? '…' : '') : undefined,
  };
}

module.exports = { serve };
