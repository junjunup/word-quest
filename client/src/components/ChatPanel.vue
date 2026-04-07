<template>
  <div class="chat-panel" :class="{ expanded: isExpanded }">
    <div class="chat-header">
      <div class="npc-info">
        <span class="npc-avatar">🐄</span>
        <span class="npc-name">小智 Wisdom</span>
        <span class="npc-status">🟢 在线</span>
      </div>
      <div class="chat-actions">
        <button class="btn-icon-sm" @click="isExpanded = !isExpanded">
          {{ isExpanded ? '🔽' : '🔼' }}
        </button>
        <button class="btn-icon-sm" @click="$emit('close')">✕</button>
      </div>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="message"
        :class="msg.role"
      >
        <div class="message-avatar">{{ msg.role === 'assistant' ? '🐄' : '🌿' }}</div>
        <div class="message-content">
          <p class="message-text">{{ msg.content }}</p>
          <span class="message-time">{{ msg.time }}</span>
        </div>
      </div>

      <!-- 正在输入指示器 -->
      <div v-if="isTyping" class="message assistant">
        <div class="message-avatar">🐄</div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷按钮 -->
    <div class="quick-actions">
      <button @click="sendQuick('这个词怎么记？')">🧠 记忆技巧</button>
      <button @click="sendQuick('给我一个例句')">📖 例句</button>
      <button @click="sendQuick('有什么近义词？')">🔗 近义词</button>
      <button @click="sendQuick('词根是什么？')">🌱 词根分析</button>
    </div>

    <div class="chat-input">
      <input
        v-model="inputText"
        type="text"
        placeholder="输入消息，与小智对话..."
        @keyup.enter="sendMessage"
        :disabled="isTyping"
      />
      <button class="send-btn" @click="sendMessage" :disabled="!inputText.trim() || isTyping">
        发送
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import { createChatStream } from '@/api/chat'

const props = defineProps({
  context: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close'])

const messages = reactive([])
const inputText = ref('')
const isTyping = ref(false)
const isExpanded = ref(true)
const messagesContainer = ref(null)
let abortController = null  // 用于取消流式请求
let isMounted = true         // 组件是否仍挂载

onMounted(() => {
  // 初始问候
  if (props.context.triggerType === 'wrong_answer') {
    addMessage('assistant', `别灰心呀！"${props.context.currentWord || '这个词'}" 确实有点难度呢~ 让我来给你分析一下吧！😊`)
  } else {
    addMessage('assistant', '嗨！我是小智 🐄 你的词汇学习伙伴！有什么想问的，尽管来问我吧~')
  }
})

function addMessage(role, content) {
  const now = new Date()
  messages.push({
    role,
    content,
    time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  })
  scrollToBottom()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isTyping.value) return

  addMessage('user', text)
  inputText.value = ''
  isTyping.value = true

  // 创建 AbortController 用于取消请求
  abortController = new AbortController()

  try {
    const response = await createChatStream({
      message: text,
      context: {
        currentWord: props.context.currentWord || '',
        playerLevel: props.context.playerLevel || 1,
        correctStreak: props.context.correctStreak || 0,
        wrongStreak: props.context.wrongStreak || 0,
        chapterName: props.context.chapterName || '',
        triggerType: props.context.triggerType || 'manual'
      }
    }, abortController?.signal)

    if (response.ok) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      let streamDone = false
      let sseBuffer = ''

      const msgIndex = messages.length
      addMessage('assistant', '')

      while (!streamDone) {
        if (!isMounted) { reader.cancel(); break }
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        sseBuffer += text
        const lines = sseBuffer.split('\n')
        // Keep the last incomplete line in buffer
        sseBuffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') { streamDone = true; break }
            try {
              const parsed = JSON.parse(data)
              fullText += parsed.content || parsed.result || ''
              if (isMounted) {
                messages[msgIndex].content = fullText
                scrollToBottom()
              }
            } catch {
              fullText += data
              if (isMounted) {
                messages[msgIndex].content = fullText
                scrollToBottom()
              }
            }
          }
        }
      }

      if (!fullText) {
        messages[msgIndex].content = '让我想想... 你可以试试联想记忆法哦！把这个单词和你熟悉的事物联系起来~'
      }
    } else {
      addMessage('assistant', '哎呀，我好像走神了~ 请再问我一次吧！😅')
    }
  } catch (err) {
    console.error('Chat error:', err)
    addMessage('assistant', '网络好像不太稳定呢，不过我们可以继续学习！加油！💪')
  } finally {
    isTyping.value = false
  }
}

// 组件卸载时取消流式请求
onUnmounted(() => {
  isMounted = false
  if (abortController) abortController.abort()
})

function sendQuick(text) {
  inputText.value = text
  sendMessage()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}
</script>

<style scoped lang="scss">
.chat-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  max-height: 500px;
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 3px solid #8b6914;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: 0 4px 0 #5b3a1a, 0 8px 30px rgba(0, 0, 0, 0.4);
  overflow: hidden;

  &:not(.expanded) {
    max-height: 50px;

    .chat-messages, .quick-actions, .chat-input { display: none; }
  }
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #8b6914;
  border-bottom: 2px solid #5b3a1a;
}

.npc-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.npc-avatar { font-size: 20px; }
.npc-name { font-weight: bold; color: #f5edd6; font-size: 14px; }
.npc-status {
  font-size: 11px;
  color: #5b8c3e;
  background: rgba(91, 140, 62, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #5b8c3e;
}

.chat-actions {
  display: flex;
  gap: 4px;
}

.btn-icon-sm {
  background: none;
  border: none;
  color: #f5edd6;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;

  &:hover { background: rgba(255, 255, 255, 0.2); }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
  max-height: 300px;
  background: rgba(255, 255, 255, 0.15);
}

.message {
  display: flex;
  gap: 8px;
  animation: slideUp 0.3s ease;

  &.user {
    flex-direction: row-reverse;

    .message-content {
      background: #5b8c3e;
      color: #f5edd6;
      border-radius: 8px 2px 8px 8px;
    }

    .message-time { text-align: right; color: rgba(245, 237, 214, 0.6); }
  }

  &.assistant {
    .message-content {
      background: rgba(255, 255, 255, 0.5);
      color: #5b3a1a;
      border-radius: 2px 8px 8px 8px;
    }
  }
}

.message-avatar { font-size: 20px; flex-shrink: 0; }

.message-content {
  max-width: 75%;
  padding: 8px 12px;
  border: 1px solid rgba(139, 105, 20, 0.3);
}

.message-text {
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.message-time {
  font-size: 10px;
  color: #8b6914;
  margin-top: 4px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;

  span {
    width: 6px;
    height: 6px;
    background: #8b6914;
    border-radius: 50%;
    animation: typing 1.2s infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-3px); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.quick-actions {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  overflow-x: auto;
  border-top: 2px solid rgba(139, 105, 20, 0.3);

  button {
    white-space: nowrap;
    padding: 4px 10px;
    background: rgba(91, 140, 62, 0.15);
    border: 2px solid #5b8c3e;
    border-radius: 4px;
    color: #3a6b1e;
    font-size: 12px;
    cursor: pointer;
    font-weight: bold;

    &:hover {
      background: rgba(91, 140, 62, 0.3);
      transform: translateY(-1px);
    }
  }
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 2px solid #8b6914;
  background: rgba(139, 105, 20, 0.15);

  input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.4);
    border: 2px solid #8b6914;
    border-radius: 4px;
    color: #5b3a1a;
    font-size: 13px;
    outline: none;

    &:focus { border-color: #5b8c3e; box-shadow: 0 0 0 2px rgba(91, 140, 62, 0.3); }
    &::placeholder { color: #a08050; }
  }

  .send-btn {
    padding: 8px 16px;
    background: #5b8c3e;
    border: 2px solid #3a6b1e;
    border-radius: 4px;
    color: #f5edd6;
    font-size: 13px;
    cursor: pointer;
    font-weight: bold;

    &:disabled { opacity: 0.4; cursor: default; }
    &:hover:not(:disabled) { background: #6b9c4e; }
  }
}
</style>
