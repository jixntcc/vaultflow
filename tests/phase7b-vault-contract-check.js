
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'css', 'app.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'public', 'js', 'core', 'store.js'), 'utf8');

assert(store.includes('function getVaults()'), 'Vault Store getter missing.');
assert(store.includes('function setVaults('), 'Vault Store setter missing.');
assert(store.includes('function upsertVault('), 'Vault Store upsert missing.');
assert(store.includes('function removeVault('), 'Vault Store remove missing.');
assert(store.includes('getVaults, setVaults, upsertVault, removeVault'), 'Vault Store contract not exported.');

assert(html.includes('function buildVaultViewModel('), 'Vault view model missing.');
assert(html.includes('function buildVaultActionContract('), 'Vault action contract missing.');
assert(html.includes('function renderVaultDesktop('), 'Desktop Vault renderer missing.');
assert(html.includes('function renderVaultMobile('), 'Mobile Vault renderer missing.');
assert(html.includes('data-vault-action="edit"'), 'Vault edit action missing.');
assert(html.includes('data-vault-action="delete"'), 'Vault delete action missing.');
assert(html.includes('data-vault-id='), 'Vault action IDs missing.');
assert(html.includes('data-vault-action][data-vault-id]'), 'Delegated Vault action handler missing.');
assert(html.includes('VaultFlowStore.removeVault(id'), 'Delete path must update Store before reload.');

assert(css.includes('.vault-actions-mobile'), 'Mobile Vault action layout missing.');
assert(css.includes('.vault-actions [data-vault-action]'), 'Vault touch-target baseline missing.');

console.log('Phase 7B Vault contract assertions passed.');
