import 'dotenv/config'
import crypto from 'crypto'

const weakSecrets = new Set([
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  'your_strong_random_secret_here',
  'change_me',
  'changeme',
  '123456',
  'password'
])

export function isWeakJwtSecret(value) {
  const secret = String(value || '').trim()
  return secret.length < 32 || weakSecrets.has(secret.toLowerCase()) || /^([a-z])\1+$/i.test(secret) || /^([0-9])\1+$/.test(secret)
}

export function validateProductionEnv(env = process.env) {
  const jwtSecret = String(env.JWT_SECRET || '').trim()
  const mongoUri = String(env.MONGODB_URI || '').trim()
  const corsOrigin = String(env.CORS_ORIGIN || '').trim()
  const errors = []

  if (!jwtSecret) errors.push('production 必须设置 JWT_SECRET')
  if (jwtSecret && isWeakJwtSecret(jwtSecret)) errors.push('production JWT_SECRET 长度必须 >=32 且不能使用弱值')
  if (!mongoUri) errors.push('production 必须显式设置 MONGODB_URI')
  if (!corsOrigin) errors.push('production 必须显式设置 CORS_ORIGIN')
  if (corsOrigin === '*' || corsOrigin.split(',').map(item => item.trim()).includes('*')) errors.push('production CORS_ORIGIN 不能为 *')

  if (errors.length > 0) {
    throw new Error(`生产安全配置无效: ${errors.join('; ')}`)
  }
}

const isProduction = process.env.NODE_ENV === 'production'
if (isProduction) {
  validateProductionEnv(process.env)
}

const jwtSecret = process.env.JWT_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex')
  console.warn('⚠️  JWT_SECRET 未设置，已自动生成随机密钥（仅限开发环境，重启后所有 token 失效）')
  console.warn('⚠️  生产环境请设置环境变量: JWT_SECRET=your_strong_secret_here')
  return generated
})()

const config = {
  isProduction,
  port: parseInt(process.env.PORT, 10) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/word-quest',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  llmServiceUrl: process.env.LLM_SERVICE_URL || 'http://localhost:8000',
  ernieApiKey: process.env.ERNIE_API_KEY || '',
  ernieSecretKey: process.env.ERNIE_SECRET_KEY || ''
}

export default config
