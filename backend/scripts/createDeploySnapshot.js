/**
 * First-deploy / periodic snapshot: MySQL dump + uploads zip.
 *
 * Output (gitignored):
 *   backend/backups/<timestamp>/
 *     defaultdb.sql
 *     uploads.zip   (if public/uploads has files)
 *     MANIFEST.txt
 *
 * Usage:
 *   node scripts/createDeploySnapshot.js
 *   npm run db:snapshot
 *
 * Requires local `mysqldump` on PATH. Uses DB_* from backend/.env (Aiven: SSL).
 */
'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions')

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
}

function findMysqldump() {
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['mysqldump'], {
    encoding: 'utf8',
  })
  const line = String(which.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean)
  if (line) return line
  const fallback = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe'
  if (process.platform === 'win32' && fs.existsSync(fallback)) return fallback
  return 'mysqldump'
}

function writeManifest(dir, rows) {
  const body = [
    'Nastavna baza Goč — deploy snapshot',
    `created_at: ${new Date().toISOString()}`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Restore hints:',
    '  mysql --ssl-mode=REQUIRED -h HOST -P PORT -u USER -p DB_NAME < defaultdb.sql',
    '  unzip uploads.zip into backend/public/uploads (or Render disk mount)',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(dir, 'MANIFEST.txt'), body, 'utf8')
}

function zipUploads(uploadsDir, zipPath) {
  if (process.platform === 'win32') {
    const ps = `
      $src = '${uploadsDir.replace(/'/g, "''")}';
      $dst = '${zipPath.replace(/'/g, "''")}';
      if (Test-Path $dst) { Remove-Item $dst -Force }
      Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dst -Force
    `
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', ps],
      { encoding: 'utf8' }
    )
    if (r.status !== 0) {
      throw new Error(`Compress-Archive failed: ${r.stderr || r.stdout}`)
    }
    return
  }
  const r = spawnSync('tar', ['-a', '-cf', zipPath, '-C', uploadsDir, '.'], { encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(`tar zip failed: ${r.stderr || r.stdout}`)
  }
}

;(async () => {
  const opts = getMysqlConnectionOptions()
  const host = opts.host
  const user = opts.user
  const password = opts.password
  const database = opts.database
  const port = opts.port || 3306
  const useSsl = Boolean(opts.ssl) || process.env.DB_SSL === 'true' || process.env.DB_SSL === 'REQUIRED'

  if (!host || !user || !database) {
    throw new Error('Missing DB connection (DB_HOST / DB_USER / DB_NAME or DATABASE_URL)')
  }

  const backupsRoot = path.join(__dirname, '..', 'backups')
  const outDir = path.join(backupsRoot, stamp())
  fs.mkdirSync(outDir, { recursive: true })

  const dumpPath = path.join(outDir, `${database}.sql`)
  const mysqldump = findMysqldump()
  const args = [
    `-h${host}`,
    `-P${String(port)}`,
    `-u${user}`,
    `--single-transaction`,
    `--routines`,
    `--triggers`,
    `--set-gtid-purged=OFF`,
    database,
  ]
  if (useSsl) args.splice(3, 0, '--ssl-mode=REQUIRED')

  console.log(`Dumping ${database}@${host}:${port} → ${dumpPath}`)
  const dump = spawnSync(mysqldump, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, MYSQL_PWD: password || '' },
  })
  if (dump.status !== 0) {
    throw new Error(`mysqldump failed (${dump.status}): ${dump.stderr || dump.stdout}`)
  }
  fs.writeFileSync(dumpPath, dump.stdout, 'utf8')

  const uploadsDir = path.join(__dirname, '..', 'public', 'uploads')
  let uploadsZip = ''
  let uploadsNote = 'missing'
  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir)
    if (entries.length > 0) {
      uploadsZip = path.join(outDir, 'uploads.zip')
      zipUploads(uploadsDir, uploadsZip)
      uploadsNote = `${entries.length} top-level entries → uploads.zip`
    } else {
      uploadsNote = 'empty directory'
    }
  }

  writeManifest(outDir, [
    ['db_host', host],
    ['db_name', database],
    ['db_port', String(port)],
    ['sql_file', path.basename(dumpPath)],
    ['sql_bytes', String(fs.statSync(dumpPath).size)],
    ['uploads', uploadsNote],
    ['ssl', useSsl ? 'REQUIRED' : 'off'],
  ])

  console.log(`Snapshot ready: ${outDir}`)
  console.log(`  SQL: ${path.basename(dumpPath)} (${fs.statSync(dumpPath).size} bytes)`)
  if (uploadsZip) console.log(`  uploads.zip: ${fs.statSync(uploadsZip).size} bytes`)
  console.log('Keep this folder offline / encrypted backup — do not commit.')
})().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
