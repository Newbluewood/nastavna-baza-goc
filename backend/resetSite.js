/**
 * resetSite.js
 *
 * Orchestrator: postavlja sajt na nulu i sidi ga prezentacionim podacima.
 *
 * Redosled:
 *   1. createDefaultDb   — kreira bazu ako ne postoji
 *   2. setupDb           — kreira sve tabele (DROP + CREATE za smeštaj tabele)
 *   3. migrateDb         — dodaje kolone/izmene na postojeće tabele
 *   4. presentationDBmockData — seed: admin, smeštaj, vesti, hero, atrakcije...
 *   5. dbSanityCheck     — verifikuje da je sve ok, izlazi sa greškom ako fali
 *
 * Upotreba:
 *   node resetSite.js           — DRY RUN (samo prikazuje šta bi uradio)
 *   node resetSite.js --execute — IZVRŠAVA sve korake
 *
 * npm alias:
 *   npm run restart-site        — dry run
 *   npm run restart-site:run    — stvarno izvršavanje
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

const DRY = !process.argv.includes('--execute');
const FLAG = DRY ? '' : '--execute';

const steps = [
  { label: '1. Kreiranje baze (createDefaultDb)',      cmd: 'node createDefaultDb.js' },
  { label: '2. Kreiranje tabela (setupDb)',             cmd: `node setupDb.js ${FLAG}` },
  { label: '3. Migracije (migrateDb)',                  cmd: `node migrateDb.js ${FLAG}` },
  { label: '4. Seed podaci (presentationDBmockData)',   cmd: `node presentationDBmockData.js ${FLAG}` },
  // Sanity check: u dry-run samo reportuje, u execute validira
  { label: '5. Sanity check (dbSanityCheck)',           cmd: `node dbSanityCheck.js --mode=${DRY ? 'report' : 'presentation'}` },
];

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

  const dir = path.join(__dirname);
  let failed = false;

  for (const step of steps) {
    separator(step.label);
    try {
      execSync(step.cmd, {
        cwd: dir,
        stdio: 'inherit',
        env: process.env,
      });
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

  console.log('\n╔═════════════════════════════════════════╗');
  console.log(`║  ${DRY ? 'DRY RUN ZAVRŠEN — nema izmena u bazi' : 'SAJT JE RESETOVAN I SPREMAN!         '}  ║`);
  console.log('╚═════════════════════════════════════════╝\n');
}

run();
