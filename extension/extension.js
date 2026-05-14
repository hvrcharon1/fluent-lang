'use strict';
/**
 * FLUENT Language — VSCode Extension
 * Provides: syntax highlighting, snippets, run/estimate/lint commands,
 * status bar integration, and output panel support.
 */

const vscode = require('vscode');
const cp     = require('child_process');
const path   = require('path');
const fs     = require('fs');

let outputChannel;
let statusBarItem;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('FLUENT');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(outputChannel, statusBarItem);

  // ── fluent.runFile ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('fluent.runFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || path.extname(editor.document.fileName) !== '.fl') {
        vscode.window.showWarningMessage('Open a .fl file to run it.');
        return;
      }
      await editor.document.save();
      const fluentBin = getFluentBin();
      const filePath  = editor.document.fileName;

      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine(`▶  fluent run "${path.basename(filePath)}"\n${'─'.repeat(60)}`);

      statusBarItem.text = '$(loading~spin) Running…';
      statusBarItem.show();

      const proc = cp.spawn(fluentBin, ['run', filePath], {
        cwd: path.dirname(filePath),
        env: { ...process.env },
      });

      proc.stdout.on('data', d => outputChannel.append(d.toString()));
      proc.stderr.on('data', d => outputChannel.append(d.toString()));
      proc.on('close', code => {
        outputChannel.appendLine(`\n${'─'.repeat(60)}\nExited with code ${code}`);
        statusBarItem.text = code === 0 ? '$(check) FLUENT' : '$(error) FLUENT';
        statusBarItem.show();
        setTimeout(() => statusBarItem.hide(), 5000);
      });
    })
  );

  // ── fluent.estimateCost ─────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('fluent.estimateCost', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || path.extname(editor.document.fileName) !== '.fl') return;
      await editor.document.save();

      const fluentBin = getFluentBin();
      const filePath  = editor.document.fileName;

      outputChannel.clear();
      outputChannel.show(true);
      outputChannel.appendLine(`💰  Cost estimate: "${path.basename(filePath)}"\n${'─'.repeat(60)}`);

      const proc = cp.spawn(fluentBin, ['estimate', filePath], {
        cwd: path.dirname(filePath),
        env: { ...process.env },
      });
      proc.stdout.on('data', d => outputChannel.append(d.toString()));
      proc.stderr.on('data', d => outputChannel.append(d.toString()));
    })
  );

  // ── fluent.dryRun ───────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('fluent.dryRun', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || path.extname(editor.document.fileName) !== '.fl') return;
      await editor.document.save();

      const fluentBin = getFluentBin();
      const filePath  = editor.document.fileName;

      cp.exec(`${fluentBin} run --dry-run "${filePath}"`, (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(`FLUENT parse error: ${stderr || err.message}`);
        } else {
          vscode.window.showInformationMessage(`✓ ${path.basename(filePath)} — ${stdout.trim()}`);
        }
      });
    })
  );

  // ── Document symbol provider (for outline view) ─────────────────────────
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'fluent' },
      new FluentSymbolProvider()
    )
  );

  // ── Hover provider ──────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: 'fluent' },
      new FluentHoverProvider()
    )
  );

  // ── Status bar for .fl files ────────────────────────────────────────────
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && path.extname(editor.document.fileName) === '.fl') {
      statusBarItem.text = '$(symbol-misc) FLUENT';
      statusBarItem.tooltip = 'Click to run this program';
      statusBarItem.command = 'fluent.runFile';
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });
}

// ── Symbol Provider ──────────────────────────────────────────────────────────
class FluentSymbolProvider {
  provideDocumentSymbols(document) {
    const symbols = [];
    const text    = document.getText();
    const lines   = text.split('\n');

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Function definitions
      const fnMatch = trimmed.match(/^To\s+(.+?)(?:\s*\(.*\))?\s*:?\s*$/i);
      if (fnMatch) {
        const range = new vscode.Range(i, 0, i, line.length);
        symbols.push(new vscode.DocumentSymbol(
          fnMatch[1].trim(), 'procedure',
          vscode.SymbolKind.Function, range, range
        ));
      }
      // Test blocks
      const testMatch = trimmed.match(/^Test\s+"([^"]+)"/i);
      if (testMatch) {
        const range = new vscode.Range(i, 0, i, line.length);
        symbols.push(new vscode.DocumentSymbol(
          testMatch[1], 'test',
          vscode.SymbolKind.Module, range, range
        ));
      }
      // Define model
      const modelMatch = trimmed.match(/^Define model\s+(\w+)/i);
      if (modelMatch) {
        const range = new vscode.Range(i, 0, i, line.length);
        symbols.push(new vscode.DocumentSymbol(
          modelMatch[1], 'model alias',
          vscode.SymbolKind.Variable, range, range
        ));
      }
    });

    return symbols;
  }
}

// ── Hover Provider ───────────────────────────────────────────────────────────
const HOVER_DOCS = {
  'claude':      '**claude** — Anthropic Claude (alias for `anthropic/claude-sonnet-4-6`)',
  'gpt':         '**gpt** — OpenAI GPT (alias for `openai/gpt-4o`)',
  'gemini':      '**gemini** — Google Gemini (alias for `google/gemini-2.0-flash`)',
  'mistral':     '**mistral** — Mistral AI (alias for `mistral/mistral-large-latest`)',
  'llama':       '**llama** — Meta Llama via Groq (alias for `groq/llama-3.3-70b-versatile`)',
  'groq':        '**groq** — Groq inference (fastest available models)',
  'deepseek':    '**deepseek** — DeepSeek (alias for `deepseek/deepseek-chat`)',
  'Ask':         '**Ask** `[model]` to `"[instruction]"` using `[input]` and call the result `[name]`.\n\nInvokes an AI model.',
  'Let':         '**Let** `[name]` be `[value]`.\n\nDeclares a variable.',
  'Set':         '**Set** `[name]` to `[value]`.\n\nUpdates an existing variable.',
  'Filter':      '**Filter** `[list]` where `[condition]` and call the result `[name]`.\n\nReturns items matching the condition.',
  'Match':       '**Match** `[value]`:\n  When `"x"`: ...\n  Otherwise: ...\nEnd match.\n\nPattern matching.',
  'Repeat':      '**Repeat** `N` times:\n  ...\nEnd repeat.\n\nExposes `iteration` (1-based) and `index` (0-based).',
  'Unless':      '**Unless** `[condition]`:\n  ...\nEnd unless.\n\nRuns the body when the condition is FALSE.',
  'Reduce':      '**Reduce** `[list]` to `[sum|count|average|min|max|product]` and call the result `[name]`.',
  'Fetch':       '**Fetch** `"[url]"` and call the result `[name]`.\n\nHTTP GET request. Returns `{status, ok, body}`.',
};

class FluentHoverProvider {
  provideHover(document, position) {
    const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z]+/);
    if (!wordRange) return null;
    const word = document.getText(wordRange);
    const doc  = HOVER_DOCS[word];
    if (!doc) return null;
    return new vscode.Hover(new vscode.MarkdownString(doc));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getFluentBin() {
  const config = vscode.workspace.getConfiguration('fluent');
  return config.get('executablePath') || 'fluent';
}

function deactivate() {}

module.exports = { activate, deactivate };
