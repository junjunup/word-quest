import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register, getUserInfo } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)
  const characterSpriteIndex = ref(0)
  const userInfoLoading = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  async function doLogin(username, password) {
    const res = await login({ username, password })
    token.value = res.data.token
    userInfo.value = res.data.user
    characterSpriteIndex.value = res.data.user.characterSpriteIndex || 0
    localStorage.setItem('token', res.data.token)
    return res.data
  }

  async function doRegister(username, password, nickname) {
    const res = await register({ username, password, nickname })
    token.value = res.data.token
    userInfo.value = res.data.user
    characterSpriteIndex.value = res.data.user.characterSpriteIndex || 0
    localStorage.setItem('token', res.data.token)
    return res.data
  }

  async function fetchUserInfo() {
    if (!token.value) return
    userInfoLoading.value = true
    try {
      const res = await getUserInfo()
      userInfo.value = res.data
      characterSpriteIndex.value = res.data.characterSpriteIndex || 0
    } finally {
      userInfoLoading.value = false
    }
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    characterSpriteIndex.value = 0
    localStorage.removeItem('token')
  }

  return { token, userInfo, isLoggedIn, userInfoLoading, characterSpriteIndex, doLogin, doRegister, fetchUserInfo, logout }
})
