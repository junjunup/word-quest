import 'dotenv/config'
import crypto from 'crypto'

// 如果未设置 JWT_SECRET，自动生成一个随机密钥（开发用）并警告
const jwtSecret = process.env.JWT_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex')
  console.warn('⚠️  JWT_SECRET 未设置，已自动生成随机密钥（仅限开发环境，重启后所有 token 失效）')
  console.warn('⚠️  生产环境请设置环境变量: JWT_SECRET=your_strong_secret_here')
  return generated
})()

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/word-quest',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  llmServiceUrl: process.env.LLM_SERVICE_URL || 'http://localhost:8000',
  ernieApiKey: process.env.ERNIE_API_KEY || '',
  ernieSecretKey: process.env.ERNIE_SECRET_KEY || ''
}

export default config
