import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 自定义插件：构建时将 __SW_CACHE_HASH__ 替换为时间戳哈希
function swCacheVersion() {
  return {
    name: 'sw-cache-version',
    transformIndexHtml: {
      order: 'post',
      handler() {
        // 在 HTML 中注入缓存版本 meta 标签（可选）
        return []
      }
    },
    generateBundle() {
      // sw.js 中的 __SW_CACHE_HASH__ 在构建时由 Vite 的 define 替换
    }
  }
}

// 自定义插件：复制 sw.js 到构建输出并在运行时替换占位符
function injectSWCacheHash() {
  let hash = ''
  return {
    name: 'inject-sw-cache-hash',
    buildStart() {
      // 在构建开始时生成唯一哈希
      hash = Date.now().toString(36)
    },
    transform(code, id) {
      // 在构建过程中替换 sw.js 中的占位符
      if (id.includes('sw.js') && code.includes('__SW_CACHE_HASH__')) {
        return code.replace(/__SW_CACHE_HASH__/g, hash)
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [vue(), injectSWCacheHash()],
  define: {
    // 全局替换，确保 sw.js 在任何阶段都能被处理
    '__SW_CACHE_HASH__': JSON.stringify(Date.now().toString(36))
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser'
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') || id.includes('node_modules/vue-echarts')) return 'chart-vendor'
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) return 'vue-vendor'
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
