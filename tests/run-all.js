
'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const tests=fs.readdirSync(__dirname).filter(f=>/^phase.*\.js$/i.test(f)).sort();
let failed=0;
for(const test of tests){
  const r=spawnSync(process.execPath,[path.join(__dirname,test)],{cwd:root,encoding:'utf8'});
  process.stdout.write(`\n[${test}] ${r.status===0?'PASS':'FAIL'}\n`);
  if(r.stdout)process.stdout.write(r.stdout);
  if(r.stderr)process.stderr.write(r.stderr);
  if(r.status!==0)failed++;
}
process.exitCode=failed?1:0;
