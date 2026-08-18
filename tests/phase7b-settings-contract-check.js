
'use strict';
const assert=require('assert'), fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public','css','app.css'),'utf8');
const store=fs.readFileSync(path.join(root,'public','js','core','store.js'),'utf8');

assert(store.includes('function getSettings()'));
assert(store.includes('function setSettings('));
assert(store.includes('getIntelligence, getSettings, setSettings'));

assert(html.includes('function buildSettingsViewModel('));
assert(html.includes('function buildSettingsActionContract('));
assert(html.includes('function renderSettingsActions('));
assert(html.includes('function renderSettingsView('));
assert(html.includes('function renderSettingsContract('));
assert(html.includes('id="settingsActionHost"'));
assert(html.includes('data-settings-action="change-password"'));
assert(html.includes('data-settings-action="export-backup"'));
assert(html.includes('data-settings-action="restore-backup"'));
assert(html.includes('data-settings-action="privacy"'));
assert(html.includes('data-settings-action]'));
assert(!html.includes('onclick="exportBackupJson(this)"'));
assert(!html.includes('onclick="exportTransactionsCsv(this)"'));

assert(css.includes('.settings-action-host'));
assert(css.includes('.settings-section [data-settings-action]'));
console.log('Phase 7B Settings contract assertions passed.');
