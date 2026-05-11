'use strict';
/**
 * FLUENT Executor
 * Walks the AST produced by the parser and evaluates each node.
 * Supports async model calls, scoped variables, function definitions,
 * control flow, and parallel execution.
 */

const { T } = require('../parser');
const providers = require('../providers');
const { Tracer } = require('../runtime/tracer');

// ── Scope ─────────────────────────────────────────────────────────────────────
class Scope {
  constructor(parent = null) {
    this.vars = {};
    this.parent = parent;
    this.functions = {};
    this.models = {};       // model alias overrides
    this.personas = {};
  }

  get(name) {
    if (name in this.vars) return this.vars[name];
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  set(name, value) {
    // If declared in a parent scope, update it there (closure semantics)
    if (!(name in this.vars) && this.parent && this.parent.has(name)) {
      this.parent.set(name, value);
    } else {
      this.vars[name] = value;
    }
  }

  has(name) {
    if (name in this.vars) return true;
    if (this.parent) return this.parent.has(name);
    return false;
  }

  setDeep(path, value) {
    // path: "patient.risk_score" → set nested field
    const parts = path.split('.');
    if (parts.length === 1) { this.set(path, value); return; }
    let obj = this.get(parts[0]);
    if (!obj || typeof obj !== 'object') obj = {};
    let cur = obj;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    this.set(parts[0], obj);
  }

  defineFunction(verb, node) {
    this.functions[verb.toLowerCase()] = node;
  }

  getFunction(verb) {
    const k = verb.toLowerCase();
    if (k in this.functions) return this.functions[k];
    if (this.parent) return this.parent.getFunction(verb);
    return null;
  }

  defineModel(alias, config) {
    this.models[alias.toLowerCase()] = config;
  }

  getModel(alias) {
    const k = alias.toLowerCase();
    if (k in this.models) return this.models[k];
    if (this.parent) return this.parent.getModel(alias);
    return null;
  }

  child() { return new Scope(this); }
}

// ── STOP signal ───────────────────────────────────────────────────────────────
class FluentStop extends Error {
  constructor(message) { super(message); this.name = 'FluentStop'; }
}
class FluentReturn {
  constructor(value) { this.value = value; }
}

// ── Executor ──────────────────────────────────────────────────────────────────
class Executor {
  constructor(options = {}) {
    this.tracer  = new Tracer(options.tracePath);
    this.options = options;
    this.globalScope = new Scope();
    this.stepCount = 0;
  }

  async run(ast) {
    const scope = this.globalScope;
    return this.execBlock(ast.body, scope);
  }

  async execBlock(nodes, scope) {
    for (const node of nodes) {
      const result = await this.exec(node, scope);
      if (result instanceof FluentReturn) return result;
    }
  }

  async exec(node, scope) {
    this.stepCount++;
    switch (node.type) {

      // ── Let x be expr ──────────────────────────────────────────────────
      case T.DECLARATION: {
        const val = await this.evalExpr(node.value, scope);
        scope.set(node.name, val);
        return val;
      }

      // ── Set x to expr ──────────────────────────────────────────────────
      case T.ASSIGNMENT: {
        const val = await this.evalExpr(node.value, scope);
        if (node.target.includes('.')) {
          scope.setDeep(node.target, val);
        } else {
          scope.set(node.target, val);
        }
        return val;
      }

      // ── Ask model to "..." ... and call the result x ───────────────────
      case T.ASK: {
        const ann = this.collectAnnotations(node.annotations);
        const modelRef = this.resolveModelRef(node.model, scope, ann);
        const instruction = typeof node.instruction === 'string'
          ? node.instruction
          : await this.evalExpr(node.instruction, scope);

        // Evaluate inputs
        const inputs = [];
        for (const inp of (node.inputs || [])) {
          inputs.push({ kind: inp.kind, value: await this.evalExpr(inp.value, scope) });
        }

        // Build call options from annotations
        const callOpts = {
          temperature: ann.temperature ? parseFloat(ann.temperature) : undefined,
          max_tokens:  ann.max_tokens  ? parseInt(ann.max_tokens)    : 1024,
          system:      ann.system      || null,
          format:      ann.format      || null,
        };

        this.tracer.startCall({ model: modelRef, instruction, step: this.stepCount });

        let response;
        try {
          response = await providers.call(modelRef, instruction, inputs, callOpts);
        } catch (err) {
          this.tracer.errorCall(err.message);
          throw err;
        }

        this.tracer.endCall({ model: response.model, input_tokens: response.input_tokens, output_tokens: response.output_tokens });

        // Parse JSON if format: json requested
        let resultValue = response.text;
        if (ann.format === 'json') {
          try {
            resultValue = JSON.parse(response.text.replace(/```json\n?|\n?```/g, '').trim());
          } catch { /* leave as string */ }
        }

        if (node.result) {
          if (node.result.includes('.')) {
            scope.setDeep(node.result, resultValue);
          } else {
            scope.set(node.result, resultValue);
          }
        }
        return resultValue;
      }

      // ── Output x ───────────────────────────────────────────────────────
      case T.OUTPUT: {
        const val = await this.evalExpr(node.value, scope);
        this.output(val);
        return val;
      }

      // ── Return x ───────────────────────────────────────────────────────
      case T.RETURN: {
        const val = await this.evalExpr(node.value, scope);
        return new FluentReturn(val);
      }

      // ── Stop with error "..." ───────────────────────────────────────────
      case T.STOP: {
        throw new FluentStop(node.message);
      }

      // ── If condition, then ... Otherwise ... ───────────────────────────
      case T.IF: {
        const condResult = await this.evalCondition(node.condition, scope);
        if (condResult) {
          const r = await this.exec(node.then, scope);
          if (r instanceof FluentReturn) return r;
        } else if (node.otherwise) {
          const r = await this.exec(node.otherwise, scope);
          if (r instanceof FluentReturn) return r;
        }
        break;
      }

      // ── For each x in collection ────────────────────────────────────────
      case T.FOR_EACH: {
        let collection = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(collection)) collection = collection ? [collection] : [];
        const runner = async (item) => {
          const childScope = scope.child();
          childScope.set(node.iterVar, item);
          await this.execBlock(node.body, childScope);
          // Merge back any mutations to the item (if it's an object)
          if (item && typeof item === 'object') {
            const updated = childScope.get(node.iterVar);
            if (updated && typeof updated === 'object') Object.assign(item, updated);
          }
        };
        if (node.parallel) {
          await Promise.all(collection.map(runner));
        } else {
          for (const item of collection) await runner(item);
        }
        break;
      }

      // ── While condition ─────────────────────────────────────────────────
      case T.WHILE: {
        let guard = 0;
        while (await this.evalCondition(node.condition, scope)) {
          if (++guard > 1000) throw new Error('Fluent: while loop exceeded 1000 iterations (safety limit)');
          const r = await this.execBlock(node.body, scope.child());
          if (r instanceof FluentReturn) return r;
        }
        break;
      }

      // ── In parallel ─────────────────────────────────────────────────────
      case T.PARALLEL: {
        await Promise.all(node.body.map(n => this.exec(n, scope.child())));
        break;
      }

      // ── Try ... If that fails ... ───────────────────────────────────────
      case T.TRY: {
        try {
          await this.exec(node.body, scope);
        } catch (err) {
          let handled = false;
          for (const fb of (node.fallbacks || [])) {
            try { await this.exec(fb, scope); handled = true; break; }
            catch { /* try next fallback */ }
          }
          if (!handled) throw err;
        }
        break;
      }

      // ── To verb (params): ... End of verb. ─────────────────────────────
      case T.FUNCTION_DEF: {
        scope.defineFunction(node.verb, node);
        break;
      }

      // ── Define model alias ──────────────────────────────────────────────
      case T.DEFINE_MODEL: {
        scope.defineModel(node.alias, { modelRef: node.model, options: node.options });
        providers.registerAlias(node.alias, node.model);
        break;
      }

      // ── Define persona ──────────────────────────────────────────────────
      case T.DEFINE_PERSONA: {
        scope.personas = scope.personas || {};
        scope.personas[node.name] = node.description;
        break;
      }

      // ── Remember ────────────────────────────────────────────────────────
      case T.REMEMBER: {
        const val = await this.evalExpr(node.value, scope);
        const mem = scope.get('__memory__') || {};
        mem[node.key] = val;
        scope.set('__memory__', mem);
        break;
      }

      // ── Recall ──────────────────────────────────────────────────────────
      case T.RECALL: {
        const mem = scope.get('__memory__') || {};
        // Simple keyword match
        const q = node.query.toLowerCase();
        const found = Object.entries(mem)
          .filter(([k]) => k.toLowerCase().includes(q))
          .map(([, v]) => v);
        scope.set(node.result, found.length === 1 ? found[0] : found);
        break;
      }

      // ── Validate ────────────────────────────────────────────────────────
      case T.VALIDATE: {
        const childScope = scope.child();
        const targetVal = scope.get(node.target.name);
        childScope.set('__validate_target__', targetVal);
        childScope.set(node.target.name, targetVal);
        await this.execBlock(node.body, childScope);
        break;
      }

      // ── Test block ──────────────────────────────────────────────────────
      case T.TEST_BLOCK: {
        // Executed by the test runner, not directly
        break;
      }

      // ── Expect ──────────────────────────────────────────────────────────
      case T.EXPECT: {
        const subject = await this.evalExpr(node.subject, scope);
        const pass = this.evalAssertion(subject, node.assertion);
        if (!pass) {
          throw new Error(`Assertion failed: expected [${JSON.stringify(subject)}] to ${node.assertion}`);
        }
        break;
      }


      // ── Match x: When ... Otherwise ... ─────────────────────────────────
      case T.MATCH: {
        const subject = await this.evalExpr(node.subject, scope);
        let matched = false;
        for (const c of node.cases) {
          const val = await this.evalExpr(c.value, scope);
          if (String(subject).toLowerCase() === String(val).toLowerCase() || subject == val) {
            for (const stmt of c.body) {
              const r = await this.exec(stmt, scope);
              if (r instanceof FluentReturn) return r;
            }
            matched = true; break;
          }
        }
        if (!matched && node.otherwise) {
          const r = await this.exec(node.otherwise, scope);
          if (r instanceof FluentReturn) return r;
        }
        break;
      }

      // ── Filter list where condition ───────────────────────────────────────
      case T.FILTER: {
        let col = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(col)) col = col ? [col] : [];
        const filtered = [];
        for (const item of col) {
          const cs = scope.child();
          cs.set('item', item); cs.set('it', item);
          const singular = (node.collection.name || '').replace(/s$/i, '') || 'item';
          cs.set(singular, item);
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            for (const [k,v] of Object.entries(item)) cs.set(k, v);
          }
          if (await this.evalCondition(node.condition, cs)) filtered.push(item);
        }
        scope.set(node.result, filtered);
        break;
      }

      // ── Map list to expr ──────────────────────────────────────────────────
      case T.MAP_COLLECT: {
        let col = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(col)) col = col ? [col] : [];
        const mapped = [];
        for (const item of col) {
          const cs = scope.child();
          cs.set('item', item); cs.set('it', item);
          const singular = (node.collection.name || '').replace(/s$/i, '') || 'item';
          cs.set(singular, item);
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            for (const [k,v] of Object.entries(item)) cs.set(k, v);
          }
          mapped.push(await this.evalExpr(node.transform, cs));
        }
        scope.set(node.result, mapped);
        break;
      }

      // ── Sort list by field ────────────────────────────────────────────────
      case T.SORT_COLLECT: {
        let col = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(col)) col = [];
        const { list: L } = require('../stdlib');
        const sorted = node.field
          ? L.sortBy(col, node.field, node.direction || 'asc')
          : [...col].sort((a, b) => {
              const sa = String(a), sb = String(b);
              return node.direction === 'desc' ? sb.localeCompare(sa) : sa.localeCompare(sb);
            });
        scope.set(node.result, sorted);
        break;
      }

      // ── Group list by field ───────────────────────────────────────────────
      case T.GROUP_COLLECT: {
        let col = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(col)) col = [];
        const { list: L } = require('../stdlib');
        scope.set(node.result, L.groupBy(col, node.field));
        break;
      }

      // ── Reduce list to sum/count/etc ──────────────────────────────────────
      case T.REDUCE_COLLECT: {
        let col = await this.evalExpr(node.collection, scope);
        if (!Array.isArray(col)) col = [];
        const { list: L } = require('../stdlib');
        const ops = { sum: () => L.sum(col), count: () => L.count(col),
                      average: () => L.average(col), avg: () => L.average(col),
                      min: () => L.min(col), max: () => L.max(col),
                      product: () => col.reduce((a,b) => a * Number(b), 1) };
        scope.set(node.result, (ops[node.operation] || ops.sum)());
        break;
      }

      // ── Repeat N times ────────────────────────────────────────────────────
      case T.REPEAT: {
        const n = parseInt(await this.evalExpr(node.count, scope)) || 0;
        for (let i = 0; i < n; i++) {
          const cs = scope.child();
          cs.set('iteration', i + 1);
          cs.set('index', i);
          const r = await this.execBlock(node.body, cs);
          if (r instanceof FluentReturn) return r;
        }
        break;
      }

      // ── Unless condition ──────────────────────────────────────────────────
      case T.UNLESS: {
        const cond = await this.evalCondition(node.condition, scope);
        if (!cond) {
          const r = await this.execBlock(node.body, scope);
          if (r instanceof FluentReturn) return r;
        }
        break;
      }

      // ── Using model x with temp N: ... End using. ────────────────────────
      case T.USING_MODEL: {
        const prev = scope.get('__model_config__') || {};
        scope.set('__model_config__', { alias: node.alias, options: node.options });
        await this.execBlock(node.body, scope);
        scope.set('__model_config__', prev);
        break;
      }

      // ── Fetch "url" and call the result x ────────────────────────────────
      case T.FETCH: {
        const { http } = require('../stdlib');
        const url = /^https?:\/\//i.test(node.url)
          ? node.url
          : scope.get(node.url) || node.url;
        const response = await http.get(url);
        if (node.result) scope.set(node.result, response);
        break;
      }

      // ── Post to "url" with body x and call the result y ──────────────────
      case T.HTTP_POST: {
        const { http } = require('../stdlib');
        const url = /^https?:\/\//i.test(node.url)
          ? node.url
          : scope.get(node.url) || node.url;
        const body = await this.evalExpr(node.body, scope);
        const response = await http.post(url, body);
        if (node.result) scope.set(node.result, response);
        break;
      }

      // ── Pass x through f1, then f2 and call the result y ─────────────────
      case T.PIPE: {
        let value = await this.evalExpr(node.input, scope);
        const stdlib = require('../stdlib');
        for (const step of node.steps) {
          const cs = scope.child();
          cs.set('input', value); cs.set('it', value);
          const probe = `${step} ${typeof value === 'string' ? value : JSON.stringify(value)}`;
          const sr = await stdlib.resolve(probe, cs);
          if (sr.handled) { value = sr.value; continue; }
          const fr = await this.callFunction(`${step} ${typeof value === 'string' ? value : ''}`, cs);
          if (fr !== null && fr !== undefined) value = fr;
        }
        if (node.result) scope.set(node.result, value);
        break;
      }

      // ── Append x to "file.txt" ────────────────────────────────────────────
      case T.APPEND_FILE: {
        const fsm = require('fs');
        const content = await this.evalExpr(node.value, scope);
        const text = typeof content === 'object'
          ? JSON.stringify(content, null, 2) : String(content);
        fsm.appendFileSync(node.path, text + '\n');
        break;
      }

      // ── Emit "event" with data ────────────────────────────────────────────
      case T.EMIT: {
        const data = node.data ? await this.evalExpr(node.data, scope) : null;
        // Store in a global event log (accessible as emitted_events)
        const log = scope.get('__events__') || [];
        log.push({ event: node.event, data, timestamp: new Date().toISOString() });
        scope.set('__events__', log);
        break;
      }

      // ── Raw (unrecognised) ──────────────────────────────────────────────
      case T.RAW: {
        // Try to evaluate as a function call if it looks like one
        if (/^the result of\s+/i.test(node.text)) {
          const match = node.text.match(/^(?:let\s+(\w+)\s+be\s+)?the result of\s+(.+)$/i);
          if (match) {
            const fnResult = await this.callFunction(match[2], scope);
            if (match[1]) scope.set(match[1], fnResult);
          }
        }
        break;
      }

      default:
        // Unknown node — skip silently
    }
  }

  // ── Expression evaluator ────────────────────────────────────────────────────
  async evalExpr(expr, scope) {
    if (expr === null || expr === undefined) return null;
    if (typeof expr === 'string') return expr;
    if (typeof expr === 'number') return expr;
    if (typeof expr === 'boolean') return expr;

    switch (expr.type) {
      case T.LITERAL: {
        if (expr.kind === 'date' && expr.value === 'NOW') return new Date().toISOString();
        if (expr.kind === 'null') return null;
        if (expr.kind === 'interpolated') {
          // Evaluate segments
          return expr.raw.replace(/"([^"]*)"/g, '$1').replace(/(\w+)/g, (m) => {
            const v = scope.get(m);
            return v !== undefined ? String(v) : m;
          });
        }
        return expr.value;
      }

      case T.IDENTIFIER: {
        const val = scope.get(expr.name);
        if (val !== undefined) return val;
        // For multi-word "identifiers" (e.g. the_sum_of_x), try stdlib
        if (expr.name.includes('_')) {
          try {
            const stdlib = require('../stdlib');
            const humanised = expr.name.replace(/_/g, ' ');
            const sr = await stdlib.resolve(humanised, scope);
            if (sr.handled) return sr.value;
          } catch (_) {}
        }
        return expr.name;
      }

      case T.FIELD_ACCESS: {
        const obj = await this.evalExpr(expr.object, scope);
        if (obj == null) return undefined;
        return obj[expr.field];
      }

      case T.RECORD: {
        const obj = {};
        for (const [k, v] of Object.entries(expr.fields)) {
          obj[k] = await this.evalExpr(v, scope);
        }
        return obj;
      }

      case T.LIST: {
        return await Promise.all(expr.elements.map(e => this.evalExpr(e, scope)));
      }

      case T.LOAD_FILE: {
        const { loadFile } = require('../runtime/files');
        return await loadFile(expr.kind, expr.path, { fps: expr.fps });
      }

      case T.FUNCTION_CALL: {
        return this.callFunction(expr.raw, scope);
      }

      // ── Stdlib expression shorthand ───────────────────────────────────────
      // Handles: "x in uppercase", "sum of scores", "round n to 2 decimal places"
      // These are parsed as raw IDENTIFIER nodes with spaces — route through stdlib
      case 'StdlibExpr': {
        const stdlib = require('../stdlib');
        const result = await stdlib.resolve(expr.raw, scope);
        return result.handled ? result.value : null;
      }

      case 'Arithmetic': {
        const l = await this.evalExpr(expr.left, scope);
        const r = await this.evalExpr(expr.right, scope);
        switch (expr.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
        }
        break;
      }

      case 'OrElse': {
        const primary = await this.evalExpr(expr.primary, scope);
        if (primary !== null && primary !== undefined && primary !== '') return primary;
        return this.evalExpr(expr.fallback, scope);
      }

      default:
        return expr;
    }
  }

  // ── Function call dispatcher ────────────────────────────────────────────────
  async callFunction(raw, scope) {
    raw = raw.trim();

    // "the result of fn arg" or just "fn arg1 arg2"
    const cleaned = raw.replace(/^the result of\s+/i, '');

    // ── stdlib resolver (string/math/list/date/json/type/http ops) ────────
    try {
      const { resolve: stdResolve } = require('../stdlib');
      const sr = await stdResolve(cleaned, scope);
      if (sr.handled) return sr.value;
    } catch (_stdErr) { /* fall through to user-defined functions */ }

    // Try to match a defined function by its verb
    // Iterate over defined functions and find a match
    const funcs = this.getAllFunctions(scope);
    for (const [verb, fnNode] of Object.entries(funcs)) {
      if (cleaned.toLowerCase().startsWith(verb.toLowerCase())) {
        const argStr = cleaned.slice(verb.length).trim();
        const rawArgs = this.splitArgs(argStr);
        const childScope = scope.child();
        fnNode.params.forEach((p, i) => {
          const paramName = p.replace(/[()]/g, '').trim();
          let argVal;
          if (rawArgs[i] !== undefined) {
            const raw = rawArgs[i];
            // String literal: strip quotes
            if (/^".*"$/.test(raw)) argVal = raw.slice(1, -1);
            // Number literal
            else if (/^-?\d+(\.\d+)?$/.test(raw)) argVal = parseFloat(raw);
            // Boolean
            else if (raw === 'true') argVal = true;
            else if (raw === 'false') argVal = false;
            // Scope lookup
            else argVal = scope.get(raw) ?? raw;
          }
          childScope.set(paramName, argVal);
        });
        const r = await this.execBlock(fnNode.body, childScope);
        if (r instanceof FluentReturn) return r.value;
        return childScope.get('__return__') || null;
      }
    }

    // Built-in pseudo-functions
    const wc = cleaned.match(/^word count of\s+(\w+)$/i);
    if (wc) {
      const text = scope.get(wc[1]) || '';
      return String(text).split(/\s+/).length;
    }

    const countOf = cleaned.match(/^(?:the count of|count of)\s+(\w+)$/i);
    if (countOf) {
      const arr = scope.get(countOf[1]);
      return Array.isArray(arr) ? arr.length : 0;
    }

    const totalCost = cleaned.match(/^total cost of this run$/i);
    if (totalCost) return `$${this.tracer.totalCost().toFixed(6)}`;

    const totalTokens = cleaned.match(/^total tokens used$/i);
    if (totalTokens) return this.tracer.totalTokens();

    return null;
  }


  // ── Argument splitter (respects quoted strings) ────────────────────────────
  splitArgs(s) {
    const parts = [];
    let current = '';
    let inQuote = false;
    for (const ch of s) {
      if (ch === '"') { inQuote = !inQuote; current += ch; }
      else if (ch === ' ' && !inQuote) {
        if (current.trim()) { parts.push(current.trim()); current = ''; }
      } else { current += ch; }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  getAllFunctions(scope) {
    const result = {};
    let s = scope;
    while (s) {
      Object.assign(result, s.functions);
      s = s.parent;
    }
    return result;
  }

  // ── Condition evaluator ─────────────────────────────────────────────────────
  async evalCondition(cond, scope) {
    if (!cond || !cond.type) return Boolean(cond);

    if (cond.op === 'and') {
      return (await this.evalCondition(cond.left, scope)) && (await this.evalCondition(cond.right, scope));
    }
    if (cond.op === 'or') {
      return (await this.evalCondition(cond.left, scope)) || (await this.evalCondition(cond.right, scope));
    }

    const left  = cond.left  ? await this.evalExpr(cond.left, scope)  : undefined;
    const right = cond.right ? await this.evalExpr(cond.right, scope) : undefined;

    switch (cond.op) {
      case '==':       return left == right || String(left).toLowerCase() === String(right).toLowerCase();
      case '!=':       return left != right;
      case '>':        return Number(left) > Number(right);
      case '<':        return Number(left) < Number(right);
      case '>=':       return Number(left) >= Number(right);
      case '<=':       return Number(left) <= Number(right);
      case 'contains': return String(left).toLowerCase().includes(String(right).toLowerCase());
      case '!contains':return !String(left).toLowerCase().includes(String(right).toLowerCase());
      case 'exists':   return left !== null && left !== undefined;
      case '!exists':  return left === null || left === undefined;
      case 'empty':    return !left || (Array.isArray(left) && left.length === 0) || left === '';
      case '!empty':   return left && !(Array.isArray(left) && left.length === 0) && left !== '';
      case 'truthy':   return Boolean(left);
    }
    return false;
  }

  // ── Assertion evaluator (for Expect) ────────────────────────────────────────
  evalAssertion(subject, assertion) {
    const a = assertion.trim();
    // Handle "not X" by negating
    const notMatch = a.match(/^not\s+(.+)$/i);
    if (notMatch) return !this.evalAssertion(subject, notMatch[1]);
    // Normalise
    const lower = a.toLowerCase();
    if (lower === 'be empty') return !subject || subject === '' || (Array.isArray(subject) && subject.length === 0);
    const fewerThan = a.match(/have fewer than\s+(\d+)\s+words?/i);
    if (fewerThan) return String(subject).split(/\s+/).length < parseInt(fewerThan[1]);
    const contain = a.match(/contain\s+"([^"]+)"/i);
    if (contain) return String(subject).toLowerCase().includes(contain[1].toLowerCase());
    const gtMatch = a.match(/be greater than\s+([\d.]+)/i);
    if (gtMatch) return Number(subject) > parseFloat(gtMatch[1]);
    const ltMatch = a.match(/be less than\s+([\d.]+)/i);
    if (ltMatch) return Number(subject) < parseFloat(ltMatch[1]);
    const atLeast = a.match(/be at least\s+([\d.]+)/i);
    if (atLeast) return Number(subject) >= parseFloat(atLeast[1]);
    const atMost = a.match(/be at most\s+([\d.]+)/i);
    if (atMost) return Number(subject) <= parseFloat(atMost[1]);
    return Boolean(subject);
  }

  // ── Model resolution (with scope overrides) ─────────────────────────────────
  resolveModelRef(modelRef, scope, ann) {
    if (modelRef.alias) {
      const override = scope.getModel(modelRef.alias);
      if (override) return override.modelRef;
    }
    return modelRef;
  }

  collectAnnotations(anns) {
    const result = {};
    for (const a of (anns || [])) {
      if (a.type === T.ANNOTATION) Object.assign(result, a.args);
    }
    return result;
  }

  output(val) {
    if (val === null || val === undefined) { console.log('(nothing)'); return; }
    if (typeof val === 'object') { console.log(JSON.stringify(val, null, 2)); return; }
    console.log(String(val));
  }
}

module.exports = { Executor, Scope, FluentStop, FluentReturn };
