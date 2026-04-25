'use strict'

require('dotenv').config()

/**
 * TLS for managed MySQL (Aiven, etc.). Aiven requires SSL; mysql2 needs explicit opt.
 * @param {string} [host]
 * @returns {{ rejectUnauthorized: boolean } | undefined}
 */
function sslOptionForHost(host) {
  if (!host) return undefined
  if (/\.aivencloud\.com$/i.test(host)) return { rejectUnauthorized: false }
  if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
    return { rejectUnauthorized: false }
  }
  return undefined
}

/**
 * Parse `DATABASE_URL` (mysql://user:pass@host:port/db?query) for mysql2.
 * Render / Aiven often expose a single URI — preferred production path.
 *
 * @param {{ skipDatabase?: boolean }} [opts]
 */
function getMysqlConnectionOptions(opts = {}) {
  const rawUrl = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim()

  if (rawUrl) {
    if (!rawUrl.startsWith('mysql://')) {
      throw new Error('DATABASE_URL must start with mysql://')
    }
    let u
    try {
      u = new URL(rawUrl)
    } catch (e) {
      throw new Error(`Invalid DATABASE_URL: ${e.message}`)
    }

    const host = u.hostname
    const user = decodeURIComponent(u.username || '')
    const password = decodeURIComponent(u.password || '')
    const databaseFromPath = (u.pathname || '').replace(/^\//, '')
    const port = u.port ? Number(u.port) : 3306

    const sslMode = (u.searchParams.get('ssl-mode') || '').toUpperCase()
    const sslParam = u.searchParams.get('ssl')
    let ssl = sslOptionForHost(host)
    if (sslMode === 'REQUIRED' || sslMode === 'VERIFY_CA' || sslMode === 'VERIFY_IDENTITY') {
      ssl = { rejectUnauthorized: false }
    }
    if (sslParam === 'true' || sslParam === '1') {
      ssl = { rejectUnauthorized: false }
    }
    if (sslParam && sslParam.includes('rejectUnauthorized')) {
      ssl = { rejectUnauthorized: false }
    }

    const out = {
      host,
      user,
      password,
      port,
      ssl,
    }
    if (!opts.skipDatabase) {
      out.database = databaseFromPath || process.env.DB_NAME || 'defaultdb'
    }
    return out
  }

  const host = process.env.DB_HOST || 'localhost'
  const out = {
    host,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    ssl: sslOptionForHost(host),
  }
  if (!opts.skipDatabase) {
    out.database = process.env.DB_NAME || 'defaultdb'
  }
  return out
}

/** Pool options for the running API (`db.js`). */
function getMysqlPoolOptions() {
  return {
    ...getMysqlConnectionOptions(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
  }
}

/** Safe log line (never print password). */
function redactedMysqlConfig(cfg) {
  return {
    host: cfg.host,
    user: cfg.user,
    database: cfg.database,
    port: cfg.port,
    ssl: cfg.ssl ? '(enabled)' : undefined,
    password: cfg.password ? '***' : '(empty)',
  }
}

module.exports = {
  getMysqlConnectionOptions,
  getMysqlPoolOptions,
  redactedMysqlConfig,
}
