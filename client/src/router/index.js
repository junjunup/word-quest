import { createRouter, createWebHistory } from 'vue-router'

function lazyLoad(importFn, retries = 3) {
  return () => {
    const attempt = (retriesLeft) => {
      return importFn().catch((err) => {
        if (retriesLeft > 0) {
          console.warn(`页面加载失败，剩余重试${retriesLeft}次...`, err)
          return new Promise(resolve => setTimeout(resolve, 1000)).then(() => attempt(retriesLeft - 1))
        }
        console.error('页面加载多次失败，请检查网络连接', err)
        // Return a fallback error component instead of throwing
        return {
          default: {
            template: `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#2d5016;color:#f5edd6;flex-direction:column;font-family:sans-serif;">
              <h2 style="margin-bottom:16px;">⚠️ 页面加载失败</h2>
              <p style="margin-bottom:16px;color:#c4b99a;">网络异常，请检查连接后重试</p>
              <button onclick="location.reload()" style="padding:10px 24px;background:#5b8c3e;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px;">🔄 重新加载</button>
            </div>`
          }
        }
      })
    }
    return attempt(retries)
  }
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
