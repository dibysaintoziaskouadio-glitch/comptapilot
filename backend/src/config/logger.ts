import pino from 'pino';
import { env, estProduction } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  ...(estProduction ? {} : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
  redact: ['req.headers.cookie', 'req.headers.authorization', 'motDePasse'],
});
