/**
 * resetSite.js
 *
 * Orchestrator: postavlja sajt na nulu i sidi ga prezentacionim podacima.
 *
 * Redosled:
 *   1. createDefaultDb        — kreira bazu ako ne postoji
 *   2. setupDb                — kreira sve tabele (DROP + CREATE za smeštaj tabele)
 *   3. migrateDb              — dodaje kolone/izmene na postojeće tabele
 *   4. presentationDBmockData — seed: admin, smeštaj, vesti, hero, atrakcije...
 *   5. dbSanityCheck          — verifikuje da je sve ok
 *   6. smokeTestRoutes        — testira API rute (zahteva živi server na PORT)
 *   7. smokeTestWriteFlow     — testira ceo write flow (zahteva živi server na PORT)
 *
 * Upotreba:
 *   node resetSite.js                    — DRY RUN (samo prikazuje šta bi uradio)
 *   node resetSite.js --execute          — reset baze + sanity check
 *   node resetSite.js --execute --smoke  — reset baze + sanity + smoke testovi
 *
 * npm alias:
 *   npm run restart-site        — dry run
 *   npm run restart-site:run    — reset + sanity (bez smoke)
 *   npm run restart-site:full   — reset + sanity + smoke (server mora biti upaljen)
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

const DRY = !process.argv.includes('--execute');
const SMOKE = process.argv.includes('--smoke');
const FLAG = DRY ? '' : '--execute';

const steps = [
  { label: '1. Kreiranje baze (createDefaultDb)',      cmd: 'node createDefaultDb.js',                                         smoke: false, quiet: false },
  { label: '2. Kreiranje tabela (setupDb)',             cmd: `node setupDb.js ${FLAG}`,                                         smoke: false, quiet: false },
  { label: '3. Migracije (migrateDb)',                  cmd: `node migrateDb.js ${FLAG}`,                                       smoke: false, quiet: true  },
  { label: '4. Seed podaci (presentationDBmockData)',   cmd: `node presentationDBmockData.js ${FLAG}`,                          smoke: false, quiet: true  },
  { label: '5. Sanity check (dbSanityCheck)',           cmd: `node dbSanityCheck.js --mode=${DRY ? 'report' : 'presentation'}`, smoke: false, quiet: false },
  { label: '6. Smoke: API rute (smokeTestRoutes)',      cmd: 'node smokeTestRoutes.js',                                         smoke: true,  quiet: false },
  { label: '7. Smoke: Write flow (smokeTestWriteFlow)', cmd: 'node smokeTestWriteFlow.js',                                      smoke: true,  quiet: false },
];

function summarizeOutput(output, stepLabel) {
  const lines = output.split('\n').map(l => l.trim()).filter(Boolean);

  // Greške uvek prikaži
  const errors = lines.filter(l => /error|greška|failed|✖/i.test(l));
  if (errors.length) {
    errors.forEach(l => console.log('  ' + l));
    return;
  }

  if (stepLabel.includes('Migracije')) {
    const executed = lines.filter(l => l.startsWith('EXECUTED:')).length;
    const skipped  = lines.filter(l => l.startsWith('SKIP:')).length;
    const dryRun   = lines.filter(l => l.startsWith('DRY-RUN:')).length;
    if (DRY) {
      console.log(`  → ${dryRun} izmena planirana, ${skipped} već postoji`);
    } else {
      console.log(`  → ${executed} izmena izvršeno, ${skipped} preskočeno`);
    }
  } else if (stepLabel.includes('Seed')) {
    const dryLines  = lines.filter(l => l.startsWith('DRY-RUN: seed'));
    const execLines = lines.filter(l => l.startsWith('EXECUTED: seed') || l.startsWith('Inserted'));
    const counts = {};
    const srcLines = DRY ? dryLines : execLines;
    srcLines.forEach(l => {
      const m = l.match(/seed (\w+)/i);
      if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
    });
    const summary = Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ');
    const adminLine = lines.find(l => l.includes('Admin credentials'));
    if (DRY) {
      console.log(`  → DRY RUN: ${srcLines.length} operacija planirana`);
    } else {
      console.log(`  → Zasidano: ${srcLines.length} redova`);
    }
    if (summary) console.log(`  → Tipovi: ${summary}`);
    if (adminLine) console.log(`  → ${adminLine}`);
  } else {
    // Ostali quiet koraci — prikaži linije koje nisu SQL/PARAMS
    lines
      .filter(l => !l.startsWith('SQL:') && !l.startsWith('PARAMS:') && !l.startsWith('DRY-RUN:') && !l.startsWith('SKIP:'))
      .forEach(l => console.log('  ' + l));
  }
}

function separator(label) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${label}`);
  console.log(line);
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║  resetSite.js  [${DRY ? 'DRY RUN — ništa se ne menja' : 'EXECUTE — baza se menja!  '}]  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (DRY) {
    console.log('\n  Dodaj --execute da stvarno pokreneš:\n  node resetSite.js --execute\n  (ili: npm run restart-site:run)\n');
  }
  if (SMOKE && DRY) {
    console.log('  NAPOMENA: --smoke bez --execute samo prikazuje korake, ne izvršava.');
  }
  if (SMOKE && !DRY) {
    console.log('  SMOKE testovi: server mora biti upaljen na portu', process.env.PORT || 3000, 'pre pokretanja!');
    console.log('  Pokreni server u drugom terminalu: npm run start\n');
  }

  const dir = path.join(__dirname);
  let failed = false;

  for (const step of steps) {
    // Preskoči smoke korake ako --smoke nije prosleđen
    if (step.smoke && !SMOKE) continue;

    separator(step.label);
    try {
      if (step.quiet) {
        const out = execSync(step.cmd, { cwd: dir, env: process.env }).toString();
        summarizeOutput(out, step.label);
      } else {
        execSync(step.cmd, { cwd: dir, stdio: 'inherit', env: process.env });
      }
    } catch (err) {
      console.error(`\n  ✖ Korak nije prošao: ${step.label}`);
      console.error(`    ${err.message}`);
      failed = true;
      break;
    }
  }

  if (failed) {
    console.error('\n╔══════════════════════════════════╗');
    console.error('║  RESET NIJE USPEO — videti gore  ║');
    console.error('╚══════════════════════════════════╝\n');
    process.exit(1);
  }

  console.log('\n╔═════════════════════════════════════════════════════════╗');
  if (DRY) {
    console.log('║  DRY RUN ZAVRŠEN — nema izmena u bazi                  ║');
  } else if (SMOKE) {
    console.log('║  SAJT JE RESETOVAN, ZASIDAN I VERIFIKOVAN! ✔           ║');
    console.log('║  Svi smoke testovi su prošli.                          ║');
  } else {
    console.log('║  SAJT JE RESETOVAN I ZASIDAN!                          ║');
    console.log('║  Sledeći korak: pokreni server pa npm run smoke:all    ║');
  }
  console.log('╚═════════════════════════════════════════════════════════╝\n');
}

run();
