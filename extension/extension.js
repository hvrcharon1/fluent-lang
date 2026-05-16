'use strict';
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const cp   = require('child_process');
const path = require('path');
const fs   = require('fs');

let client, outputChannel, statusBarItem;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel('FLUENT');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(outputChannel, statusBarItem);
  startLanguageServer(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('fluent.runFile',      runFile),
    vscode.commands.registerCommand('fluent.estimateCost', () => runCmd('estimate')),
    vscode.commands.registerCommand('fluent.dryRun',       () => runCmd('run', ['--dry-run'])),
    vscode.commands.registerCommand('fluent.lintFile',     () => runCmd('lint')),
    vscode.commands.registerCommand('fluent.runTests',     () => runCmd('test', ['./tests/'])),
    vscode.commands.registerCommand('fluent.openRepl',     openRepl),
  );
  vscode.window.onDidChangeActiveTextEditor(updateStatusBar);
  updateStatusBar(vscode.window.activeTextEditor);
}

function startLanguageServer(context) {
  const candidates = [
    path.join(context.extensionPath, '..', 'bin', 'fluent-language-server.js'),
    path.join(__dirname, '..', 'bin', 'fluent-language-server.js'),
  ];
  const serverModule = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  if (!serverModule) {
    outputChannel.appendLine('[FLUENT] LSP server not found — install: npm i -g fluent-lang');
    return;
  }
  const serverOptions = {
    run:   { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio, options: { execArgv: ['--inspect=6009'] } },
  };
  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'fluent' }],
    synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher('**/*.fl') },
    outputChannel,
  };
  client = new LanguageClient('fluent', 'FLUENT Language Server', serverOptions, clientOptions);
  client.start();
  context.subscriptions.push(client);
  client.onReady().then(() => {
    outputChannel.appendLine('[FLUENT] Language server ready.');
    statusBarItem.text = '$(check) FLUENT LSP';
    statusBarItem.show();
    setTimeout(() => updateStatusBar(vscode.window.activeTextEditor), 2000);
  });
}

function runFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || path.extname(editor.document.fileName) !== '.fl') {
    vscode.window.showWarningMessage('Open a .fl file first.'); return;
  }
  editor.document.save().then(() => {
    const filePath = editor.document.fileName;
    outputChannel.clear(); outputChannel.show(true);
    outputChannel.appendLine(`▶  fluent run "${path.basename(filePath)}"\n${'─'.repeat(60)}`);
    statusBarItem.text = '$(loading~spin) Running…'; statusBarItem.show();
    const proc = cp.spawn(getFluentBin(), ['run', filePath], { cwd: path.dirname(filePath), env: process.env });
    proc.stdout.on('data', d => outputChannel.append(d.toString()));
    proc.stderr.on('data', d => outputChannel.append(d.toString()));
    proc.on('close', code => {
      outputChannel.appendLine(`\n${'─'.repeat(60)}\nExited: ${code}`);
      statusBarItem.text = code === 0 ? '$(check) FLUENT' : '$(error) FLUENT';
      setTimeout(() => updateStatusBar(vscode.window.activeTextEditor), 4000);
    });
  });
}

function runCmd(cmd, extra = []) {
  const editor = vscode.window.activeTextEditor;
  const fp = editor?.document?.fileName;
  if (!fp || path.extname(fp) !== '.fl') { vscode.window.showWarningMessage('Open a .fl file first.'); return; }
  outputChannel.clear(); outputChannel.show(true);
  const args = [cmd, ...extra, fp];
  outputChannel.appendLine(`$ fluent ${args.join(' ')}\n${'─'.repeat(60)}`);
  const proc = cp.spawn(getFluentBin(), args, { cwd: path.dirname(fp), env: process.env });
  proc.stdout.on('data', d => outputChannel.append(d.toString()));
  proc.stderr.on('data', d => outputChannel.append(d.toString()));
}

function openRepl() {
  const t = vscode.window.createTerminal({ name: 'FLUENT REPL' });
  t.sendText(`${getFluentBin()} repl`); t.show();
}

function updateStatusBar(editor) {
  if (editor && path.extname(editor.document.fileName) === '.fl') {
    statusBarItem.text    = '$(symbol-misc) FLUENT';
    statusBarItem.tooltip = 'Click to run | FLUENT language';
    statusBarItem.command = 'fluent.runFile';
    statusBarItem.show();
  } else { statusBarItem.hide(); }
}

function getFluentBin() {
  return vscode.workspace.getConfiguration('fluent').get('executablePath') || 'fluent';
}
function deactivate() { return client?.stop(); }
module.exports = { activate, deactivate };
