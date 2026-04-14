'use strict';

const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../config');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `${ts} ${level}: ${message}\n${stack}` : `${ts} ${level}: ${message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: config.env === 'production' ? prodFormat : devFormat,
    silent: config.env === 'test',
  }),
];

if (config.env === 'production') {
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      format: prodFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: prodFormat,
    })
  );
}

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  transports,
});

module.exports = logger;
