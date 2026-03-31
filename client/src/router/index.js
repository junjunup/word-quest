import { createRouter, createWebHistory } from 'vue-router'

// chunk 加载失败重试计数器
let chunkRetryCount = 0
const MAX_CHUNK_RETRIES = 2

function lazyLoad(importFn) {
  return () => importFn().catch((err) => {
    if (chunkRetryCount < MAX_CHUNK_RETRIES) {
      chunkRetryCount++
      console.warn(`页面加载失败，第${chunkRetryCount}次重试...`, err)
      window.location.reload()
    } else {
      console.error('页面加载多次失败，请检查网络连接', err)
      // 不再刷新，避免无限循环
    }
  })
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: lazyLoad(() => import('@/views/HomeView.vue'))
  },
  {
    path: '/game',
    name: 'Game',
    component: lazyLoad(() => import('@/views/GameView.vue')),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: lazyLoad(() => import('@/views/DashboardView.vue')),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: lazyLoad(() => import('@/views/ProfileView.vue')),
    meta: { requiresAuth: true }
  },
  // 404 兜底路由
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  // 需要认证但未登录 → 跳转登录页
  if (to.meta.requiresAuth && !token) {
    next({ name: 'Home' })
    return
  }

  next()
})

export default router
