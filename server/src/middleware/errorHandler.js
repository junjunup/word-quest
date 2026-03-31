export function errorHandler(err, req, res, next) {
  // 防止 null/undefined err
  if (!err) {
    return res.status(500).json({ success: false, message: '未知错误' })
  }

  console.error('[Error]', err.message || err)

  // Mongoose 校验错误 → 400
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map(e => e.message).join('; ')
    return res.status(400).json({ success: false, message: messages || '数据校验失败' })
  }

  // Mongoose 唯一键冲突 → 409
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: '数据已存在（唯一键冲突）' })
  }

  // JSON 解析错误 → 400
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: '请求体 JSON 格式错误' })
  }

  const statusCode = err.statusCode || 500
  // 生产环境不暴露内部错误信息
  const message = statusCode === 500 ? '服务器内部错误' : (err.message || '服务器内部错误')

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
