import { h } from 'vue'
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
        // Return a render-function fallback. Runtime-only Vue builds cannot compile `template` strings,
        // so a template fallback would itself render blank after a failed dynamic import.
        return {
          default: {
            name: 'LazyLoadErrorFallback',
            render() {
              return h('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                  background: '#2d5016',
                  color: '#f5edd6',
                  flexDirection: 'column',
                  fontFamily: 'sans-serif',
                  textAlign: 'center',
                  padding: '24px'
                }
              }, [
                h('h2', { style: { marginBottom: '16px' } }, '⚠️ 页面加载失败'),
                h('p', { style: { marginBottom: '16px', color: '#c4b99a' } }, '页面资源加载异常，可能是版本更新缓存未刷新。请重新加载后再试。'),
                h('button', {
                  type: 'button',
                  style: {
                    padding: '10px 24px',
                    background: '#5b8c3e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  },
                  onClick: () => window.location.reload()
                }, '🔄 重新加载')
              ])
            }
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
  {
    path: '/social',
    name: 'Social',
    component: lazyLoad(() => import('@/views/SocialView.vue')),
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

/**
 * 简易 JWT 过期检查（不验签，只看 exp 字段）
 * @returns {boolean} token 是否有效（存在且未过期）
 */
function isTokenValid() {
  const token = localStorage.getItem('token')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    // exp 是秒级时间戳
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // 过期 → 主动清理
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return false
    }
    return true
  } catch {
    // token 格式异常 → 视为无效
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return false
  }
}

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  // 需要认证但 token 无效/过期 → 跳转登录页
  if (to.meta.requiresAuth && !isTokenValid()) {
    next({ name: 'Home' })
    return
  }

  next()
})

export default router
