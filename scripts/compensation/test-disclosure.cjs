const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const page = fs.readFileSync('app/commission-calculator/page.tsx', 'utf8');
for (const phrase of ['Residential Sales Fee', 'Signed terms control', '295 — unless a signed exception applies', '$295 per completed closing', 'Signed $0 or custom-fee exceptions', 'existing executed agreements remain unchanged', 'lesser of $195 or 20%', 'does not apply lease rules', 'not a payout authorization']) assert.ok(page.includes(phrase), phrase);
assert.ok(!page.includes('e.g. 395'));
// Copy-only change: preserve every financial expression/state and API handler.
const baseline = execFileSync('git', ['show', 'origin/master:app/commission-calculator/page.tsx'], {encoding:'utf8'});
assert.equal(page.slice(0,page.indexOf('  return (')), baseline.slice(0,baseline.indexOf('  return (')));
assert.equal(page.match(/setTransactionFee\(295\)/g).length, 1);
console.log('PASS: prospective disclosure, signed exceptions, legacy disclaimer; calculator logic unchanged');
