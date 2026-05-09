'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const chalk = require('chalk');

const VAULT_PATH = path.join(os.homedir(), '.fluent', 'credentials.json');

function loadVault() {
  try {
    if (fs.existsSync(VAULT_PATH)) {
      return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
    }
  } catch { }
  return {};
}

function saveVault(data) {
  fs.mkdirSync(path.dirname(VAULT_PATH), { recursive: true });
  fs.writeFileSync(VAULT_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function envSet(key, value) {
  const vault = loadVault();
  vault[key] = value;
  saveVault(vault);
  process.env[key] = value;
  console.log(chalk.green(`✓ Set ${key}`));
}

function envList() {
  const vault = loadVault();
  const keys = Object.keys(vault);
  if (!keys.length) {
    console.log(chalk.yellow('No credentials configured. Use: fluent env set KEY=value'));
    return;
  }
  console.log(chalk.bold('\n  Configured Credentials\n'));
  const maxLen = Math.max(...keys.map(k => k.length));
  for (const key of keys) {
    const val = vault[key];
    const masked = val.slice(0, 4) + '****' + val.slice(-4);
    console.log(`  ${key.padEnd(maxLen + 2)} ${chalk.dim(masked)}`);
  }
  console.log();
}

function loadEnv() {
  // Load vault into process.env (without overwriting existing env vars)
  const vault = loadVault();
  for (const [k, v] of Object.entries(vault)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

module.exports = { envSet, envList, loadEnv };
