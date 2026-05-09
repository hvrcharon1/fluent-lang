'use strict';
const fs = require('fs');
const { estimateCost } = require('../providers');

class Tracer {
  constructor(tracePath = null) {
    this.tracePath = tracePath;
    this.entries = [];
    this._current = null;
    this._startTime = Date.now();
  }

  startCall({ model, instruction, step }) {
    this._current = { step, model, instruction: typeof instruction === 'string' ? instruction.slice(0, 120) : '[expr]', startMs: Date.now() };
  }

  endCall({ model, input_tokens, output_tokens }) {
    if (!this._current) return;
    const latency_ms = Date.now() - this._current.startMs;
    const [provider, modelName] = model.includes('/') ? model.split('/') : ['unknown', model];
    const cost = estimateCost(provider, modelName, input_tokens, output_tokens);
    const entry = {
      step: this._current.step,
      type: 'model_call',
      model,
      instruction: this._current.instruction,
      input_tokens,
      output_tokens,
      latency_ms,
      cost_usd: cost.total,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    this._current = null;
  }

  errorCall(message) {
    if (this._current) {
      this.entries.push({ ...this._current, type: 'error', error: message, timestamp: new Date().toISOString() });
      this._current = null;
    }
  }

  totalCost() {
    return this.entries.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
  }

  totalTokens() {
    return this.entries.reduce((sum, e) => sum + (e.input_tokens || 0) + (e.output_tokens || 0), 0);
  }

  report() {
    const cost = this.totalCost();
    const tokens = this.totalTokens();
    const elapsed = ((Date.now() - this._startTime) / 1000).toFixed(2);
    return { calls: this.entries.length, total_tokens: tokens, total_cost_usd: cost, elapsed_s: parseFloat(elapsed), entries: this.entries };
  }

  save() {
    if (!this.tracePath) return;
    try {
      fs.mkdirSync(require('path').dirname(this.tracePath), { recursive: true });
      fs.writeFileSync(this.tracePath, JSON.stringify(this.report(), null, 2));
    } catch (e) { /* ignore */ }
  }
}

module.exports = { Tracer };
