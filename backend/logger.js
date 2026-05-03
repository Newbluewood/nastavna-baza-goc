'use strict';

/**
 * logger.js
 * 
 * A systematic wrapper for console logging. 
 * Provides an 'info', 'warn', and 'error' interface so that
 * we can easily swap it with Winston/Morgan later without 
 * changing the business logic.
 */

const format = () => new Date().toISOString();

const logger = {
  info: (msg) => {
    console.log(`[${format()}] INFO: ${msg}`);
  },
  warn: (msg) => {
    console.warn(`[${format()}] WARN: ${msg}`);
  },
  error: (msg) => {
    console.error(`[${format()}] ERROR: ${msg}`);
  },
  // Compatibility with legacy code if any
  requestLogger: {
    info: (msg) => console.log(`[${format()}] REQ: ${msg}`)
  }
};

module.exports = logger;