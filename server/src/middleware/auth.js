import jwt from 'jsonwebtoken'
import config from '../config/index.js'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    req.userId = decoded.userId
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: '认证令牌无效或已过期' })
  }
}
