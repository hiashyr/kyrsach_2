import { createLogger, format, transports } from 'winston';
import path from 'path';

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      )
    }),
    new transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error' 
    }),
    new transports.File({ 
      filename: path.join('logs', 'combined.log') 
    })
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join('logs', 'exceptions.log') 
    })
  ]
});

// Для промисов-исключений
process.on('unhandledRejection', (reason) => {
  throw reason;
});

export default logger;