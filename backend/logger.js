// Winston logger with daily rotation for best practice
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const logFormat = format.combine(
  format.timestamp(),
  format.json()
);

const requestLogger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.DailyRotateFile({
      filename: 'logs/requests-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d', // keep 14 days
      zippedArchive: true
    })
  ]
});

const qaLogger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.DailyRotateFile({
      filename: 'logs/qa-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // keep 30 days
      zippedArchive: true
    })
  ]
});

// Returns a logger for a specific user (personal Q&A log)
function getUserQaLogger(userId) {
  return createLogger({
    level: 'info',
    format: logFormat,
    transports: [
      new transports.DailyRotateFile({
        filename: `logs/qa-user-${userId}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        zippedArchive: true
      })
    ]
  });
}

module.exports = { requestLogger, qaLogger, getUserQaLogger };