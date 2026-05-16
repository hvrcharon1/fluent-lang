-- FLUENT Language — Neovim Configuration
-- Copy this file to: ~/.config/nvim/after/plugin/fluent.lua
--
-- Requirements:
--   - neovim >= 0.9
--   - nvim-lspconfig    (https://github.com/neovim/nvim-lspconfig)
--   - nvim-treesitter   (https://github.com/nvim-treesitter/nvim-treesitter)
--   - mason.nvim        (optional, for auto-install of LSP)
--
-- Install fluent runtime first:
--   npm install -g fluent-lang

local lspconfig = require('lspconfig')
local configs   = require('lspconfig.configs')

-- ── 1. Register the FLUENT file type ────────────────────────────────────────
vim.filetype.add({
  extension = { fl = 'fluent' },
  filename  = {},
  pattern   = {},
})

-- ── 2. Register FLUENT LSP config (if not already known to lspconfig) ───────
if not configs.fluent_ls then
  configs.fluent_ls = {
    default_config = {
      cmd          = { 'fluent-language-server', '--stdio' },
      filetypes    = { 'fluent' },
      root_dir     = lspconfig.util.root_pattern('fluent.pkg', '.fluentrc', '.git'),
      single_file_support = true,
      settings     = {},
    },
  }
end

-- ── 3. Start the FLUENT LSP server ──────────────────────────────────────────
lspconfig.fluent_ls.setup({
  on_attach = function(client, bufnr)
    local opts = { buffer = bufnr, silent = true }

    -- Go-to-definition
    vim.keymap.set('n', 'gd', vim.lsp.buf.definition,      opts)
    -- Hover documentation
    vim.keymap.set('n', 'K',  vim.lsp.buf.hover,           opts)
    -- Find references
    vim.keymap.set('n', 'gr', vim.lsp.buf.references,      opts)
    -- Rename symbol
    vim.keymap.set('n', '<leader>rn', vim.lsp.buf.rename,  opts)
    -- Code actions (quick fixes)
    vim.keymap.set('n', '<leader>ca', vim.lsp.buf.code_action, opts)
    -- Show diagnostics
    vim.keymap.set('n', '<leader>d', vim.diagnostic.open_float, opts)
    -- Next/prev diagnostic
    vim.keymap.set('n', ']d', vim.diagnostic.goto_next, opts)
    vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, opts)

    -- FLUENT-specific keymaps
    -- Run current file
    vim.keymap.set('n', '<leader>fr', function()
      vim.cmd('!fluent run ' .. vim.fn.expand('%'))
    end, vim.tbl_extend('force', opts, { desc = 'FLUENT: Run file' }))

    -- Estimate cost
    vim.keymap.set('n', '<leader>fe', function()
      vim.cmd('!fluent estimate ' .. vim.fn.expand('%'))
    end, vim.tbl_extend('force', opts, { desc = 'FLUENT: Estimate cost' }))

    -- Lint
    vim.keymap.set('n', '<leader>fl', function()
      vim.cmd('!fluent lint ' .. vim.fn.expand('%'))
    end, vim.tbl_extend('force', opts, { desc = 'FLUENT: Lint file' }))

    vim.notify('FLUENT LSP attached', vim.log.levels.INFO)
  end,

  capabilities = (function()
    local ok, cmp_nvim_lsp = pcall(require, 'cmp_nvim_lsp')
    if ok then return cmp_nvim_lsp.default_capabilities() end
    return vim.lsp.protocol.make_client_capabilities()
  end)(),

  settings = {
    fluent = {
      defaultModel = 'claude',
      enableLinting = true,
    },
  },
})

-- ── 4. Tree-sitter (syntax highlighting) ────────────────────────────────────
-- Add this to your nvim-treesitter setup() call:
--
-- require('nvim-treesitter.configs').setup({
--   ensure_installed = { 'fluent', ... },  -- auto-install
--   highlight = { enable = true },
-- })
--
-- Register the FLUENT parser (until it's merged into nvim-treesitter):
local parser_config = require('nvim-treesitter.parsers').get_parser_configs()
parser_config.fluent = {
  install_info = {
    url           = 'https://github.com/hvrcharon1/fluent-lang',
    files         = { 'tree-sitter-fluent/src/parser.c' },
    branch        = 'main',
    generate_requires_npm = true,
    requires_generate_from_grammar = true,
  },
  filetype = 'fluent',
}

-- ── 5. Syntax highlighting fallback (no tree-sitter) ────────────────────────
-- If tree-sitter isn't set up, use basic vim regex syntax:
vim.cmd([[
  augroup FluENTSyntax
    autocmd!
    autocmd BufNewFile,BufRead *.fl setfiletype fluent
    autocmd FileType fluent syntax clear
    autocmd FileType fluent syntax match fluENTComment    /--.*$/
    autocmd FileType fluent syntax match fluENTKeyword    /\<\(Let\|Set\|Ask\|Output\|Return\|If\|Otherwise\|For each\|While\|Match\|When\|Repeat\|Unless\|Using model\|To\|End\|Test\|Expect\|Filter\|Map\|Sort\|Group\|Reduce\|Fetch\|Pass\|Append\|Emit\|Run agent\)\>/
    autocmd FileType fluent syntax match fluENTModel      /\<\(claude\|gpt\|gemini\|mistral\|llama\|groq\|deepseek\)\>/
    autocmd FileType fluent syntax match fluENTAnnotation /@\w\+/
    autocmd FileType fluent syntax region fluENTString    start=/"/ end=/"/
    autocmd FileType fluent syntax match fluENTNumber     /\<-\?\d\+\(\.\d\+\)\?\>/
    autocmd FileType fluent highlight link fluENTComment    Comment
    autocmd FileType fluent highlight link fluENTKeyword    Keyword
    autocmd FileType fluent highlight link fluENTModel      Type
    autocmd FileType fluent highlight link fluENTAnnotation PreProc
    autocmd FileType fluent highlight link fluENTString     String
    autocmd FileType fluent highlight link fluENTNumber     Number
  augroup END
]])

-- ── 6. Auto-commands ─────────────────────────────────────────────────────────
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'fluent',
  callback = function()
    -- 2-space indentation for .fl files
    vim.opt_local.tabstop     = 2
    vim.opt_local.shiftwidth  = 2
    vim.opt_local.expandtab   = true
    vim.opt_local.commentstring = '-- %s'
    -- Show diagnostics on cursor hold
    vim.opt_local.updatetime  = 500
  end,
})

vim.notify('[fluent.lua] FLUENT language support loaded', vim.log.levels.DEBUG)
