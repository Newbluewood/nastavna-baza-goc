#!/usr/bin/env node
/**
 * Diff env KEY NAMES only (never values).
 *
 * Usage (from backend/):
 *   npm run env:diff -- --service=api
 *   npm run env:diff -- --service=api --remote=render-baza-goc-api.keys.txt
 *   npm run env:diff -- --service=agent --local=../../chat-agent/.env --remote=render-agent.keys.txt
 *   npm run env:diff -- --service=fe
 *
 * Remote file: one key name per line, or KEY=value lines (values are ignored).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(BACKEND_ROOT, 'env.manifest.json');

function usage(exitCode = 1) {
  console.log(`Usage: node scripts/diffEnvKeys.js --service=api|agent|fe [--local=path] [--remote=path]

  --service   Which manifest block (api = baza-goc-api, agent = chat-agent, fe = netlify)
  --local     Path to .env (default from manifest relative to backend/)
  --remote    Optional paste file: key names only, or KEY=value (values stripped)

Compares names against the canonical manifest. Never prints secret values.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { service: null, local: null, remote: null, help: false };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') out.help = true;
    else if (raw.startsWith('--service=')) out.service = raw.slice('--service='.length).trim();
    else if (raw.startsWith('--local=')) out.local = raw.slice('--local='.length).trim();
    else if (raw.startsWith('--remote=')) out.remote = raw.slice('--remote='.length).trim();
  }
  return out;
}

/** Parse .env or keys.txt → Set of key names. Never keep values. */
function loadKeyNames(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(BACKEND_ROOT, filePath);
  if (!fs.existsSync(abs)) {
    return { abs, keys: null, error: `file not found: ${abs}` };
  }
  const text = fs.readFileSync(abs, 'utf8');
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // KEY=value or bare KEY
    const eq = trimmed.indexOf('=');
    const name = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) keys.add(name);
  }
  return { abs, keys, error: null };
}

function sorted(setOrArr) {
  return [...setOrArr].sort((a, b) => a.localeCompare(b));
}

function printSection(title, items) {
  console.log(`\n${title} (${items.length})`);
  if (items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const k of items) console.log(`  - ${k}`);
}

function checkRequiredOneOf(requiredOneOf, present) {
  const failures = [];
  for (const group of requiredOneOf || []) {
    if (!group.some((k) => present.has(k))) {
      failures.push(group.join(' | '));
    }
  }
  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.service) usage(args.help ? 0 : 1);

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest missing: ${MANIFEST_PATH}`);
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const svc = manifest.services?.[args.service];
  if (!svc) {
    console.error(`Unknown service "${args.service}". Use: ${Object.keys(manifest.services).join(', ')}`);
    process.exit(1);
  }

  const localPath = args.local || svc.localEnv;
  const local = loadKeyNames(localPath);
  const remote = args.remote ? loadKeyNames(args.remote) : null;

  const required = new Set(svc.required || []);
  const optional = new Set(svc.optional || []);
  const known = new Set([...required, ...optional]);
  // requiredOneOf keys count as known
  for (const group of svc.requiredOneOf || []) {
    for (const k of group) known.add(k);
  }

  console.log(`env:diff — service=${args.service} (${svc.label})`);
  console.log(`manifest: ${path.relative(BACKEND_ROOT, MANIFEST_PATH) || 'env.manifest.json'}`);
  console.log(`local:    ${local.abs}${local.error ? ` ⚠ ${local.error}` : ` (${local.keys.size} keys)`}`);
  if (remote) {
    console.log(`remote:   ${remote.abs}${remote.error ? ` ⚠ ${remote.error}` : ` (${remote.keys.size} keys)`}`);
  } else {
    console.log('remote:   (not provided — comparing local ↔ manifest only)');
  }

  const localKeys = local.keys || new Set();
  const remoteKeys = remote && remote.keys ? remote.keys : null;

  // --- vs manifest ---
  const missingRequiredLocal = sorted([...required].filter((k) => !localKeys.has(k)));
  // DATABASE_URL vs DB_HOST: soften if requiredOneOf satisfied
  const oneOfFailLocal = checkRequiredOneOf(svc.requiredOneOf, localKeys);
  const extraLocal = sorted([...localKeys].filter((k) => !known.has(k)));

  printSection('Missing required on local (vs manifest)', missingRequiredLocal);
  if (oneOfFailLocal.length) {
    printSection('Missing requiredOneOf on local', oneOfFailLocal);
  }
  printSection('Extra on local (not in manifest)', extraLocal);

  if (remoteKeys) {
    const missingOnLocal = sorted([...remoteKeys].filter((k) => !localKeys.has(k)));
    const missingOnRemote = sorted([...localKeys].filter((k) => !remoteKeys.has(k)));
    const missingRequiredRemote = sorted([...required].filter((k) => !remoteKeys.has(k)));
    const extraRemote = sorted([...remoteKeys].filter((k) => !known.has(k)));
    const oneOfFailRemote = checkRequiredOneOf(svc.requiredOneOf, remoteKeys);

    printSection('Missing on local (present on remote)', missingOnLocal);
    printSection('Missing on remote (present on local)', missingOnRemote);
    printSection('Missing required on remote (vs manifest)', missingRequiredRemote);
    if (oneOfFailRemote.length) {
      printSection('Missing requiredOneOf on remote', oneOfFailRemote);
    }
    printSection('Extra on remote (not in manifest)', extraRemote);
  }

  // Pair reminders (names only)
  const pairNotes = (manifest.pairs || []).filter((p) => (p.services || []).includes(args.service));
  if (pairNotes.length) {
    console.log('\nPair checks (manual — values never shown)');
    for (const p of pairNotes) {
      const onLocal = localKeys.has(p.key) ? 'present' : 'MISSING';
      const onRemote = remoteKeys ? (remoteKeys.has(p.key) ? 'present' : 'MISSING') : 'n/a';
      console.log(`  - ${p.key}: local=${onLocal}, remote=${onRemote}`);
      if (p.note) console.log(`      ${p.note}`);
      if (p.mustEqualHost && manifest.hosts?.[p.mustEqualHost]) {
        console.log(`      expected host/value shape: ${manifest.hosts[p.mustEqualHost]}`);
      }
    }
  }

  console.log('\nDone. No secret values were printed.');
  const hardFail =
    missingRequiredLocal.length > 0 ||
    oneOfFailLocal.length > 0 ||
    (remoteKeys &&
      ((svc.required || []).some((k) => !remoteKeys.has(k)) ||
        checkRequiredOneOf(svc.requiredOneOf, remoteKeys).length > 0));
  process.exit(hardFail ? 1 : 0);
}

main();
