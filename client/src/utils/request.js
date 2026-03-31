import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

// 请求拦截器：注入token
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
request.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/'
    }
    return Promise.reject(error.response?.data || error)
  }
)

export default request
