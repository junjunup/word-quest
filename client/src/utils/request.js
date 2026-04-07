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

    // 优先使用后端返回的错误信息
    const serverData = error.response?.data
    if (serverData && typeof serverData === 'object' && serverData.message) {
      return Promise.reject(serverData)
    }

    // 服务器无响应或代理失败时，提供友好提示
    const status = error.response?.status
    let message = '网络异常，请检查服务器是否启动'
    if (status === 500) {
      message = '服务器内部错误，请稍后重试'
    } else if (status === 502 || status === 503) {
      message = '服务器暂时不可用，请稍后重试'
    } else if (!error.response) {
      message = '无法连接到服务器，请确认后端服务已启动'
    }

    return Promise.reject({ success: false, message })
  }
)

export default request
