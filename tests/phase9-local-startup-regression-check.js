'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean);

assert.strictEqual(
  scripts.some(block => block.includes('<!--') || block.includes('-->')),
  false,
  'Inline JavaScript contains HTML comment syntax.'
);
assert(html.includes('id="demoBtn"'), 'Demo button missing.');
assert(html.includes("document.getElementById('demoBtn').addEventListener('click', startDemoMode);"),
  'Demo button handler missing.');
assert(html.includes('function startDemoMode()'), 'Demo mode function missing.');
assert(server.includes('module.exports = app;'), 'Express app export missing.');

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'development', PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
child.stdout.on('data', d => { output += d.toString(); });
child.stderr.on('data', d => { output += d.toString(); });

const timer = setTimeout(() => {
  child.kill('SIGTERM');
  console.log('Local server startup smoke test passed.');
}, 2500);

child.on('error', err => {
  clearTimeout(timer);
  console.error(err);
  process.exitCode = 1;
});

child.on('exit', code => {
  if (code !== null && code !== 0) {
    clearTimeout(timer);
    console.error(output);
    process.exitCode = 1;
  }
});
