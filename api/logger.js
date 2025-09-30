const levels = ['debug', 'info', 'warn', 'error'];
const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
const minIndex = levels.includes(level) ? levels.indexOf(level) : 1;

const formatPayload = (message, meta = {}) => {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { message, details: meta };
  }
  return { message, ...meta };
};

const log = (targetLevel, message, meta) => {
  const idx = levels.indexOf(targetLevel);
  if (idx === -1 || idx < minIndex) {
    return;
  }
  const payload = formatPayload(message, meta);
  const serialized = JSON.stringify({
    level: targetLevel,
    timestamp: new Date().toISOString(),
    ...payload,
  });
  // eslint-disable-next-line no-console
  console[targetLevel === 'debug' ? 'log' : targetLevel](serialized);
};

export const logger = {
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
