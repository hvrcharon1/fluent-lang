# FLUENT — IDE & Editor Support

Full language intelligence for `.fl` files across every major editor,
powered by the FLUENT Language Server (LSP).

---

## Quick Start — All Editors

**Step 1: Install the runtime**
```bash
npm install -g fluent-lang
```

**Step 2: Set API credentials**
```bash
fluent env set ANTHROPIC_API_KEY=sk-ant-...
fluent env set OPENAI_API_KEY=sk-...        # optional
fluent env set GOOGLE_API_KEY=...           # optional
```

**Step 3: Install your editor's plugin** (see below)

---

## VS Code / VS Codium / Cursor / Windsurf

### Option A — VS Code Marketplace (recommended)

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS)
3. Type: `ext install datacules.fluent-lang`
4. Press Enter

**Or** search "FLUENT" in the Extensions panel.

### Option B — Manual VSIX install

```bash
# Download the latest VSIX from GitHub Releases
curl -Lo fluent-lang.vsix \
  https://github.com/hvrcharon1/fluent-lang/releases/latest/download/fluent-lang.vsix

# Install
code --install-extension fluent-lang.vsix
```

### Option C — Open VSX (for VSCodium / Gitpod / Eclipse Theia)

```bash
# In VSCodium
codium --install-extension datacules.fluent-lang

# Or from Open VSX Registry: https://open-vsx.org/extension/datacules/fluent-lang
```

### Features (VS Code)

| Feature | Description |
|---------|-------------|
| Diagnostics | Parse errors shown inline as you type |
| Completions | Keywords, model names, stdlib, user variables |
| Hover docs | Hover over `claude`, `Ask`, `Filter`, `@model`, etc. |
| Go-to-definition | `F12` on any variable or function name |
| Outline | All functions, tests, model aliases in the Explorer |
| Code actions | Quick-fix suggestions (add `@model`, fix key exposure) |
| Run command | `Ctrl+Shift+P → FLUENT: Run Program` or click ▶ in title bar |
| Estimate cost | `FLUENT: Estimate API Cost` before running |
| Lint | `FLUENT: Lint File` — 7 static analysis rules |
| REPL | `FLUENT: Open REPL` — interactive REPL in integrated terminal |

### VS Code Settings (`settings.json`)

```json
{
  "fluent.executablePath": "fluent",
  "fluent.languageServerPath": "fluent-language-server",
  "fluent.defaultModel": "claude",
  "fluent.enableLsp": true,
  "fluent.trace.server": "off"
}
```

---

## Neovim

### Requirements

- Neovim ≥ 0.9
- [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) (optional, for richer highlighting)

### Install with lazy.nvim

```lua
-- In your lazy.nvim plugins config:
{
  'neovim/nvim-lspconfig',
  config = function()
    -- Load the FLUENT config
    dofile(vim.fn.stdpath('data') .. '/fluent-lang/editors/neovim/fluent.lua')
  end,
}
```

### Manual install

```bash
# Clone or copy the config file
cp editors/neovim/fluent.lua ~/.config/nvim/after/plugin/fluent.lua
```

Then in Neovim:
```
:source ~/.config/nvim/after/plugin/fluent.lua
```

### Keymaps (set by fluent.lua)

| Key | Action |
|-----|--------|
| `gd` | Go to definition |
| `K` | Show hover documentation |
| `gr` | Find references |
| `<leader>rn` | Rename symbol |
| `<leader>ca` | Code actions |
| `<leader>fr` | Run current file |
| `<leader>fe` | Estimate API cost |
| `<leader>fl` | Lint file |

### With mason.nvim (auto-install LSP)

```lua
-- mason-lspconfig will auto-install fluent-language-server
require('mason-lspconfig').setup({
  ensure_installed = { 'fluent_ls' },
})
```

### Tree-sitter (syntax highlighting)

```lua
require('nvim-treesitter.configs').setup({
  ensure_installed = { 'fluent' },
  highlight = { enable = true },
})
```

---

## Emacs

### With use-package + eglot (recommended)

```elisp
;; In your init.el or config.el:
(add-to-list 'load-path "/path/to/fluent-lang/editors/emacs/")

(use-package fluent-mode
  :mode "\\.fl\\'"
  :hook (fluent-mode . eglot-ensure)
  :custom
  (fluent-executable "fluent")
  (fluent-language-server-executable "fluent-language-server"))
```

### With lsp-mode

```elisp
(use-package fluent-mode
  :mode "\\.fl\\'"
  :hook (fluent-mode . lsp-deferred))
```

### Keybindings

| Key | Action |
|-----|--------|
| `C-c C-r` | Run file |
| `C-c C-e` | Estimate cost |
| `C-c C-l` | Lint file |
| `C-c C-d` | Dry-run |
| `C-c C-z` | Open REPL |

### MELPA submission

`fluent-mode.el` is ready for MELPA submission.
See [MELPA contributing guide](https://github.com/melpa/melpa/blob/master/CONTRIBUTING.org).

---

## Sublime Text 3 / 4

### Install

```bash
# macOS
cp editors/sublime-text/Fluent.sublime-syntax \
   ~/Library/Application\ Support/Sublime\ Text/Packages/FLUENT/

# Linux
cp editors/sublime-text/Fluent.sublime-syntax \
   ~/.config/sublime-text/Packages/FLUENT/

# Windows
copy editors\sublime-text\Fluent.sublime-syntax ^
     "%APPDATA%\Sublime Text\Packages\FLUENT\"
```

### LSP support (via LSP package)

1. Install [LSP](https://packagecontrol.io/packages/LSP) from Package Control
2. Open: `Preferences → Package Settings → LSP → Settings`
3. Add to your config:

```json
{
  "clients": {
    "fluent-language-server": {
      "enabled": true,
      "command": ["fluent-language-server", "--stdio"],
      "selector": "source.fluent"
    }
  }
}
```

### Package Control submission

The `Fluent.sublime-syntax` file is ready for submission to Package Control.
See [Package Control docs](https://packagecontrol.io/docs/submitting_a_package).

---

## Zed

### Install

```bash
# Copy the language config to Zed's languages directory
mkdir -p ~/.config/zed/languages/fluent
cp editors/zed/languages/fluent/config.toml ~/.config/zed/languages/fluent/
cp editors/zed/languages/fluent/highlights.scm ~/.config/zed/languages/fluent/
```

Zed will automatically use `fluent-language-server --stdio` for LSP features.

### Zed Extension (coming soon)

A proper Zed extension will be submitted to the [Zed Extension Registry](https://github.com/zed-industries/extensions).

---

## Helix

### Install

Add to `~/.config/helix/languages.toml`:

```toml
[[language]]
name        = "fluent"
scope       = "source.fluent"
file-types  = ["fl"]
comment-token = "--"
indent      = { tab-width = 4, unit = "    " }
language-servers = ["fluent-language-server"]
roots       = ["fluent.pkg", ".fluentrc", ".git"]

[language-server.fluent-language-server]
command = "fluent-language-server"
args    = ["--stdio"]
```

Copy the highlights query:
```bash
mkdir -p ~/.config/helix/runtime/queries/fluent
cp tree-sitter-fluent/queries/highlights.scm \
   ~/.config/helix/runtime/queries/fluent/
```

---

## JetBrains IDEs (IntelliJ, WebStorm, PyCharm, Rider)

### Via LSP4IJ Plugin (recommended)

1. Install [LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) from the JetBrains Marketplace
2. Open: `Settings → Languages & Frameworks → Language Servers → Add`
3. Configure:

| Field | Value |
|-------|-------|
| Name | FLUENT Language Server |
| File types | `*.fl` |
| Command | `fluent-language-server --stdio` |

### Native plugin (roadmap)

A native JetBrains plugin using the IntelliJ Platform SDK is on the roadmap.
File patterns, syntax highlighting, and run configurations will be bundled.
Track progress: [GitHub Issues](https://github.com/hvrcharon1/fluent-lang/issues)

---

## Vim (classic)

Add to your `.vimrc`:

```vim
" File type detection
au BufNewFile,BufRead *.fl setfiletype fluent

" Syntax highlighting
augroup FluENTSyntax
  autocmd!
  autocmd FileType fluent syntax clear
  autocmd FileType fluent syn match flComment    /--.*$/
  autocmd FileType fluent syn match flKeyword    /\<\(Let\|Set\|Ask\|Output\|If\|Otherwise\|For each\|While\|Match\|When\|Repeat\|Unless\|To\|End\|Test\|Expect\|Filter\|Map\|Sort\|Group\|Reduce\|Fetch\|Append\|Emit\)\>/
  autocmd FileType fluent syn match flModel      /\<\(claude\|gpt\|gemini\|mistral\|llama\|groq\)\>/
  autocmd FileType fluent syn match flAnnotation /@\w\+/
  autocmd FileType fluent syn region flString    start=/"/ end=/"/
  autocmd FileType fluent syn match flNumber     /-\?\d\+\(\.\d\+\)\?/
  autocmd FileType fluent hi link flComment    Comment
  autocmd FileType fluent hi link flKeyword    Keyword
  autocmd FileType fluent hi link flModel      Type
  autocmd FileType fluent hi link flAnnotation PreProc
  autocmd FileType fluent hi link flString     String
  autocmd FileType fluent hi link flNumber     Number
augroup END

" Indentation
autocmd FileType fluent setlocal ts=4 sw=4 expandtab

" Run commands
autocmd FileType fluent nnoremap <buffer> <leader>fr :!fluent run %<CR>
autocmd FileType fluent nnoremap <buffer> <leader>fe :!fluent estimate %<CR>
autocmd FileType fluent nnoremap <buffer> <leader>fl :!fluent lint %<CR>
```

---

## GitHub — Syntax Highlighting on github.com

FLUENT `.fl` files will be highlighted on GitHub once the
[Linguist](https://github.com/github-linguist/linguist) pull request is merged.

**To contribute:**
1. Fork [github-linguist/linguist](https://github.com/github-linguist/linguist)
2. Add to `lib/linguist/languages.yml`:
```yaml
FLUENT:
  type: programming
  extensions:
    - ".fl"
  tm_scope: source.fluent
  ace_mode: text
  language_id: 900001
  color: "#2244EE"
  interpreters:
    - fluent
```
3. Add sample files to `samples/FLUENT/`
4. Submit a PR

---

## Monaco Editor (Web / VS Code Web)

```typescript
import * as monaco from 'monaco-editor';

// Register FLUENT language
monaco.languages.register({ id: 'fluent', extensions: ['.fl'] });

// Set tokenizer rules
monaco.languages.setMonarchTokensProvider('fluent', {
  keywords: ['Let', 'Set', 'Ask', 'Output', 'Return', 'If', 'Otherwise',
             'For each', 'While', 'Match', 'When', 'Repeat', 'Unless',
             'Filter', 'Map', 'Sort', 'Group', 'Reduce', 'Fetch', 'Test',
             'To', 'End', 'Define model', 'Using model'],
  models: ['claude', 'gpt', 'gemini', 'mistral', 'llama', 'groq', 'deepseek'],
  tokenizer: {
    root: [
      [/--.*$/, 'comment'],
      [/@\w+/, 'annotation'],
      [/"[^"]*"/, 'string'],
      [/-?\d+(\.\d+)?/, 'number'],
      [/\b(true|false|yes|no|nothing)\b/, 'constant'],
      [/\b(claude|gpt|gemini|mistral|llama|groq|deepseek)\b/, 'type'],
      [/\b(Let|Set|Ask|Output|If|Otherwise|For each|While|Match|When|Repeat|Unless|To|End|Test|Filter|Map|Sort|Group|Reduce)\b/, 'keyword'],
    ],
  },
});

// Register LSP (via monaco-languageclient)
// See: https://github.com/TypeFox/monaco-languageclient
```

---

## CodeMirror 6 (Web Apps)

```typescript
import { LanguageSupport, StreamLanguage } from '@codemirror/language';

const fluent = StreamLanguage.define({
  name: 'fluent',
  token(stream) {
    if (stream.match(/--.*$/)) return 'comment';
    if (stream.match(/@\w+/))  return 'meta';
    if (stream.match(/"[^"]*"/)) return 'string';
    if (stream.match(/-?\d+(\.\d+)?/)) return 'number';
    if (stream.match(/\b(Let|Set|Ask|Output|If|Otherwise|While|For each|Match|When|Repeat|Unless|Filter|Map|Sort|Group|Reduce|To|End|Test)\b/)) return 'keyword';
    if (stream.match(/\b(claude|gpt|gemini|mistral|llama|groq)\b/)) return 'typeName';
    stream.next();
    return null;
  },
});

// Use in your editor:
// extensions: [new LanguageSupport(fluent)]
```

---

## GitHub Actions — Auto-publishing

Secrets required in your GitHub repository:

| Secret | Description |
|--------|-------------|
| `VSCE_PAT` | Personal Access Token from [Azure DevOps](https://marketplace.visualstudio.com/manage) |
| `OVSX_PAT` | Token from [open-vsx.org](https://open-vsx.org/) |
| `NPM_TOKEN` | npm publish token (`npm token create`) |

**Creating VSCE_PAT:**
1. Sign in at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Create publisher `datacules` (or your publisher name)
3. Go to Azure DevOps → User settings → Personal access tokens
4. Create token: scope = `Marketplace (Publish)`, all organizations

**Publish manually:**
```bash
# VS Code Marketplace
cd extension && npx vsce publish

# Open VSX
npx ovsx publish extension/fluent-lang-*.vsix --pat $OVSX_PAT

# npm
npm publish --access public
```

---

## Support

- [GitHub Issues](https://github.com/hvrcharon1/fluent-lang/issues)
- [Extension README](./extension/README.md)
- [Language Spec](./index.html)
