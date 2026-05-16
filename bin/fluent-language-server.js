#!/usr/bin/env node
'use strict';
/**
 * FLUENT Language Server — Binary Entry Point
 * Used by editors to start the LSP server via stdio.
 *
 * VSCode extension references this as: node bin/fluent-language-server.js --stdio
 * Neovim/lspconfig:  cmd = { "fluent-language-server", "--stdio" }
 * Emacs/eglot:       '("fluent-language-server" "--stdio")
 * Zed:               { "command": "fluent-language-server", "args": ["--stdio"] }
 */
require('../src/lsp/server');
