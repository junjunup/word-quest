/**
 * Cycle 4: LLM 对话缓存服务
 * LRU 缓存：同词+同触发类型 → 24h 内复用，降低 API 调用成本
 */
import crypto from 'crypto'

const MAX_ENTRIES = 500
const TTL_MS = 24 * 60 * 60 * 1000 // 24 小时

const cache = new Map()

function buildKey(word, triggerType, message) {
  const raw = `${word || ''}|${triggerType || 'manual'}|${(message || '').slice(0, 80)}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

function evictExpired() {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > TTL_MS) {
      cache.delete(key)
    }
  }
}

function evictOldest() {
  if (cache.size <= MAX_ENTRIES) return
  // 删最旧的 10%
  const count = Math.max(1, Math.floor(MAX_ENTRIES * 0.1))
  const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
  for (let i = 0; i < count && i < sorted.length; i++) {
    cache.delete(sorted[i][0])
  }
}

/**
 * 查询缓存
 * @returns {string|null} 缓存的回复或 null
 */
export function getCachedReply(word, triggerType, message) {
  const key = buildKey(word, triggerType, message)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key)
    return null
  }
  // 命中后更新时间戳（LRU）
  entry.timestamp = Date.now()
  return entry.reply
}

/**
 * 写入缓存
 */
export function setCachedReply(word, triggerType, message, reply) {
  const key = buildKey(word, triggerType, message)
  cache.set(key, { reply, timestamp: Date.now() })
  evictOldest()
  // 定期清理过期条目（概率触发，避免每次都全量遍历）
  if (Math.random() < 0.1) evictExpired()
}

/**
 * 缓存统计
 */
export function getCacheStats() {
  return {
    size: cache.size,
    maxEntries: MAX_ENTRIES,
    ttlHours: TTL_MS / 3600000
  }
}
