/**
 * Create least-privilege MySQL user for chat-agent (Render).
 *
 * Runtime needs:
 *   SELECT  rooms/facilities (+ translations), reservations, guests, chat_messages
 *           + content tables used by Qdrant ingest (pages, themes, news, attractions, menu)
 *   INSERT  chat_messages
 *   INSERT/UPDATE ai_budget_monthly
 *
 * Does NOT get write on inquiries / CMS / reservations.
 *
 * Dry-run by default. Pass --execute to apply.
 * Password: AGENT_DB_PASSWORD env, or auto-generated (printed once, not committed).
 *
 * After success: set chat-agent Render env to this user (DB_USER / DB_PASSWORD or DATABASE_URL).
 * Keep site API on the existing full user.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const crypto = require('crypto')
const mysql = require('mysql2/promise')
const { getMysqlConnectionOptions } = require('../lib/mysqlConnectionOptions')

const EXECUTE = process.argv.includes('--execute')
const AGENT_USER = process.env.AGENT_DB_USER || 'goc_agent'
const AGENT_HOST = process.env.AGENT_DB_HOST_PATTERN || '%'

const SELECT_TABLES = [
  'rooms',
  'room_translations',
  'facilities',
  'facility_translations',
  'reservations',
  'guests',
  'chat_messages',
  'ai_budget_monthly',
  'pages',
  'page_translations',
  'themes',
  'theme_translations',
  'attractions',
  'attraction_translations',
  'restaurant_menu_items',
  'news',
  'news_translations',
]

function quoteIdent(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

function generatePassword() {
  return crypto.randomBytes(24).toString('base64url')
}

function escapeSqlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")
}

;(async () => {
  const admin = await mysql.createConnection(getMysqlConnectionOptions())
  const [[dbRow]] = await admin.query('SELECT DATABASE() AS db')
  const dbName = dbRow.db
  if (!dbName) throw new Error('No database selected')

  const password = process.env.AGENT_DB_PASSWORD || generatePassword()
  const userIdent = `'${escapeSqlString(AGENT_USER)}'@'${escapeSqlString(AGENT_HOST)}'`
  const dbIdent = quoteIdent(dbName)

  const statements = [
    `CREATE USER IF NOT EXISTS ${userIdent} IDENTIFIED BY '${escapeSqlString(password)}'`,
    `ALTER USER ${userIdent} IDENTIFIED BY '${escapeSqlString(password)}'`,
    ...SELECT_TABLES.map(
      (table) => `GRANT SELECT ON ${dbIdent}.${quoteIdent(table)} TO ${userIdent}`
    ),
    `GRANT INSERT ON ${dbIdent}.${quoteIdent('chat_messages')} TO ${userIdent}`,
    `GRANT INSERT, UPDATE ON ${dbIdent}.${quoteIdent('ai_budget_monthly')} TO ${userIdent}`,
    'FLUSH PRIVILEGES',
  ]

  console.log(`${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} — user ${AGENT_USER}@${AGENT_HOST} on ${dbName}`)
  for (const sql of statements) {
    const safeLog = sql.includes('IDENTIFIED BY')
      ? sql.replace(/IDENTIFIED BY '.*'/, "IDENTIFIED BY '***'")
      : sql
    console.log(`  ${safeLog}`)
    if (EXECUTE) {
      await admin.query(sql)
    }
  }

  if (EXECUTE) {
    // Verify: agent can read rooms, cannot delete inquiries.
    const agentOpts = {
      ...getMysqlConnectionOptions(),
      user: AGENT_USER,
      password,
      database: dbName,
    }
    // Prefer discrete vars over URI so we override user/password cleanly.
    delete agentOpts.uri
    const agent = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: AGENT_USER,
      password,
      database: dbName,
      port: Number(process.env.DB_PORT || 3306),
      ssl: process.env.DB_SSL === 'REQUIRED' || /\.aivencloud\.com$/i.test(process.env.DB_HOST || '')
        ? { rejectUnauthorized: false }
        : undefined,
    })
    const [rooms] = await agent.query('SELECT COUNT(*) AS c FROM rooms')
    console.log(`  verify SELECT rooms: ${rooms[0].c}`)
    let denied = false
    try {
      await agent.query('DELETE FROM inquiries WHERE 1=0')
    } catch (err) {
      denied = true
      console.log(`  verify DELETE inquiries blocked: ${err.code || err.message}`)
    }
    if (!denied) {
      console.warn('  WARNING: DELETE on inquiries was NOT blocked — check grants')
    }
    await agent.end()

    console.log('\n--- Set these on chat-agent Render (do not commit) ---')
    console.log(`DB_USER=${AGENT_USER}`)
    console.log(`DB_PASSWORD=${password}`)
    console.log(`DB_HOST=${process.env.DB_HOST}`)
    console.log(`DB_NAME=${dbName}`)
    console.log(`DB_PORT=${process.env.DB_PORT || 3306}`)
    console.log('DB_SSL=true')
    console.log('Site API should keep the existing full-privilege DB user.')
  } else {
    console.log('\nDry-run only. Re-run with --execute to create/update the user.')
  }

  await admin.end()
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
