import logger from '../utils/logger.js'

/**
 * Lightweight security audit logger for write-heavy or sensitive routes.
 * @param {string} action Audit action name.
 * @returns {import('express').RequestHandler} Express middleware.
 */
export function auditLogger(action) {
  return (req, res, next) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      logger.info('audit_event', {
        action,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        userId: req.userId || null,
        ip: req.ip,
        durationMs: Date.now() - startedAt
      })
    })
    next()
  }
}
