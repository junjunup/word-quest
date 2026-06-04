// Service Worker — Word Quest PWA
// 构建时 __SW_CACHE_HASH__ 会被 Vite 替换为最新构建哈希
const CACHE_NAME = 'word-quest-static-__SW_CACHE_HASH__'

// 开发模式检测：占位符未被替换 → 立即自毁，避免干扰 Vite 热更新
if (CACHE_NAME.includes('__SW_CACHE_HASH__')) {
  self.addEventListener('install', () => {
    self.skipWaiting()
  })
  self.addEventListener('activate', () => {
    self.registration.unregister().then(() => {
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.navigate(client.url))
      })
    })
  })
  // 不注册 fetch 等事件 — 直接退出
  throw new Error('DEV_MODE_SW_SELF_DESTRUCT')
}

// 预缓存：安装时立即缓存的静态资源
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest'
]

// 运行时缓存策略
const STRATEGIES = {
  // HTML 页面：Network First → Cache Fallback
  html: /^\/($|#|\?)/,
  // 静态资源 (JS/CSS/图片/字体)：Stale While Revalidate
  static: /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i,
  // 音频文件：Cache First（大文件，不变）
  audio: /\.(mp3|ogg|wav|m4a)$/i,
  // API 请求：Network Only
  api: /\/api\//
}

function getStrategy(url) {
  if (STRATEGIES.api.test(url.pathname)) return 'network_only'
  if (STRATEGIES.audio.test(url.pathname)) return 'cache_first'
  if (STRATEGIES.static.test(url.pathname)) return 'stale_while_revalidate'
  if (STRATEGIES.html.test(url.pathname + url.hash)) return 'network_first'
  return 'network_first'
}

// ── Install: 预缓存核心资源 ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: 清理旧版本缓存 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: 按策略处理请求 ──
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 不缓存非 http/https 协议（chrome-extension:// 等）
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const strategy = getStrategy(url)

  switch (strategy) {
    case 'network_only':
      // API：只走网络
      event.respondWith(
        fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
      )
      break

    case 'cache_first':
      // 音频：优先缓存
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response?.status === 200 && response.type === 'basic') {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}))
            }
            return response
          })
        })
      )
      break

    case 'stale_while_revalidate':
      // JS/CSS/图片：用缓存立即响应，后台更新
      event.respondWith(
        caches.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response?.status === 200 && response.type === 'basic') {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}))
            }
            return response
          }).catch(() => cached)
          return cached || fetchPromise
        })
      )
      break

    case 'network_first':
    default:
      // HTML：优先网络，离线用缓存
      event.respondWith(
        fetch(request).then((response) => {
          if (response?.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}))
          }
          return response
        }).catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
      )
      break
  }
})
