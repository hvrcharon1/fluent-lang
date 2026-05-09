'use strict';
/**
 * FLUENT Public API
 * Allows embedding Fluent programs in Node.js projects.
 *
 * Usage:
 *   const fluent = require('fluent-lang');
 *   const result = await fluent.run('Ask claude to "hello" and call the result r. Output r.');
 *   const ast    = fluent.parse('Let x be 42.');
 */

const { parse }    = require('./parser');
const { Executor } = require('./executor');
const providers    = require('./providers');
const { loadEnv }  = require('./runtime/env');

async function run(source, scope = {}) {
  loadEnv();
  const ast = parse(typeof source === 'string' ? source : require('fs').readFileSync(source, 'utf8'));
  const executor = new Executor({});
  for (const [k, v] of Object.entries(scope)) {
    executor.globalScope.set(k, v);
  }
  await executor.run(ast);
  return { scope: executor.globalScope.vars, trace: executor.tracer.report() };
}

module.exports = {
  run,
  parse,
  Executor,
  providers,
  loadEnv,
};
