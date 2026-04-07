<template>
  <div class="home-view">
    <div class="home-background">
      <!-- 飘落树叶替代星空（位置在 setup 中固定，避免重渲染闪烁） -->
      <div class="leaf" v-for="(leaf, i) in leafData" :key="i"
        :style="{
          left: leaf.left,
          top: leaf.top,
          animationDelay: leaf.delay,
          animationDuration: leaf.duration,
          fontSize: leaf.size,
          opacity: leaf.opacity
        }">
        {{ leaf.emoji }}
      </div>
    </div>

    <div class="home-content">
      <div class="logo-section">
        <h1 class="game-title">词汇大冒险</h1>
        <h2 class="game-subtitle">WORD QUEST</h2>
        <p class="game-desc">🌾 穿越词汇田园 · 击败遗忘怪物 · AI学伴陪你闯关</p>
      </div>

      <div class="auth-card card">
        <div class="auth-tabs">
          <button :class="{ active: authMode === 'login' }" @click="authMode = 'login'">🏠 登录</button>
          <button :class="{ active: authMode === 'register' }" @click="authMode = 'register'">🌱 注册</button>
        </div>

        <form @submit.prevent="handleAuth" class="auth-form">
          <div class="form-group">
            <label>用户名</label>
            <input v-model="form.username" type="text" placeholder="请输入用户名" required minlength="3" />
          </div>

          <div class="form-group" v-if="authMode === 'register'">
            <label>昵称</label>
            <input v-model="form.nickname" type="text" placeholder="请输入游戏昵称" required />
          </div>

          <div class="form-group">
            <label>密码</label>
            <input v-model="form.password" type="password" placeholder="请输入密码" required minlength="6" />
          </div>

          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
            {{ loading ? '请稍候...' : (authMode === 'login' ? '🌿 开始冒险' : '🌱 创建账号') }}
          </button>
        </form>
      </div>

      <div class="footer-info">
        <p>🌻 AI辅助游戏化英语词汇学习系统 | 毕业设计项目</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

// 预计算树叶数据，避免 template 中 Math.random() 导致重渲染闪烁
const emojis = ['🍃', '🌿', '🍂', '☘️']
const leafData = Array.from({ length: 20 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  delay: `${Math.random() * 8}s`,
  duration: `${6 + Math.random() * 6}s`,
  size: `${10 + Math.random() * 12}px`,
  opacity: 0.3 + Math.random() * 0.4,
  emoji: emojis[Math.floor(Math.random() * 4)]
}))

const authMode = ref('login')
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  username: '',
  password: '',
  nickname: ''
})

async function handleAuth() {
  loading.value = true
  errorMsg.value = ''
  try {
    if (authMode.value === 'login') {
      await userStore.doLogin(form.username, form.password)
    } else {
      await userStore.doRegister(form.username, form.password, form.nickname || form.username)
    }
    router.push('/game')
  } catch (err) {
    errorMsg.value = err?.message || err?.data?.message || '操作失败，请检查网络连接后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.home-view {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #4a8c28 0%, #3a6b1e 40%, #2d5016 100%);
}

.leaf {
  position: absolute;
  animation: leafFall linear infinite;
  pointer-events: none;
}

@keyframes leafFall {
  0% {
    transform: translateY(-20px) translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(100vh) translateX(80px) rotate(360deg);
    opacity: 0;
  }
}

.home-content {
  position: relative;
  z-index: 1;
  text-align: center;
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.logo-section {
  margin-bottom: 30px;
}

.game-title {
  font-size: 42px;
  font-family: 'Press Start 2P', Microsoft YaHei;
  color: #ffc847;
  text-shadow: 0 3px 0 #5b3a1a, 0 0 20px rgba(255, 200, 71, 0.3);
  margin-bottom: 8px;
}

.game-subtitle {
  font-size: 16px;
  font-family: 'Press Start 2P', Arial;
  color: #f5edd6;
  letter-spacing: 6px;
  font-weight: normal;
  text-shadow: 0 2px 0 #5b3a1a;
}

.game-desc {
  margin-top: 14px;
  color: #c4b99a;
  font-size: 14px;
}

.auth-card {
  padding: 24px;
}

.auth-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 3px solid #8b6914;

  button {
    flex: 1;
    background: none;
    border: none;
    color: #8b6914;
    font-size: 16px;
    padding: 10px;
    cursor: pointer;
    transition: all 0.3s;
    border-bottom: 3px solid transparent;
    margin-bottom: -3px;
    font-weight: bold;

    &.active {
      color: #5b3a1a;
      border-bottom-color: #5b3a1a;
      background: rgba(255, 255, 255, 0.1);
    }

    &:hover:not(.active) {
      background: rgba(255, 255, 255, 0.05);
    }
  }
}

.auth-form {
  .form-group {
    margin-bottom: 16px;
    text-align: left;

    label {
      display: block;
      color: #5b3a1a;
      font-size: 14px;
      margin-bottom: 6px;
      font-weight: bold;
    }

    input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.3);
      border: 2px solid #8b6914;
      border-radius: 4px;
      color: #5b3a1a;
      font-size: 15px;
      outline: none;
      transition: border-color 0.3s;

      &:focus {
        border-color: #5b8c3e;
        box-shadow: 0 0 0 2px rgba(91, 140, 62, 0.3);
      }

      &::placeholder {
        color: #a08050;
      }
    }
  }
}

.error-msg {
  color: #d45b3e;
  font-size: 13px;
  margin-bottom: 10px;
  font-weight: bold;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  font-size: 18px;
  margin-top: 8px;
}

.footer-info {
  margin-top: 30px;
  color: #6b9c4e;
  font-size: 12px;
}
</style>
