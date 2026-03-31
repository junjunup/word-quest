import request from '@/utils/request'

// 发送聊天消息（SSE流式调用要另外实现）
export const sendMessage = (data) => request.post('/chat/message', data)

// SSE流式对话 - 返回 fetch Response，支持 AbortController
export function createChatStream(data, signal) {
  const token = localStorage.getItem('token')
  const url = '/api/chat/stream'

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data),
    signal
  })
}
