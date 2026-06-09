<!-- Cycle 5: 词库选择组件 — CET-4/CET-6 等词库切换 -->
<template>
  <div class="wordbook-overlay" @click.self="$emit('close')">
    <div class="wordbook-panel">
      <h2 class="wb-title">📚 选择词库</h2>
      <p class="wb-desc">切换词库会改变关卡中的单词来源，不影响已解锁的进度。</p>

      <div v-if="loading" class="wb-loading">加载词库列表...</div>
      <div v-else-if="error" class="wb-error">⚠️ {{ error }}</div>

      <div v-else class="wb-list">
        <div
          v-for="wb in wordbooks"
          :key="wb.wordbookId"
          class="wb-card"
          :class="{ 'wb-selected': wb.wordbookId === selectedId }"
          @click="selectWordbook(wb.wordbookId)"
        >
          <div class="wb-info">
            <span class="wb-name">{{ formatName(wb.name) }}</span>
            <span class="wb-count">{{ wb.total > 0 ? wb.total + ' 词' : '待导入' }}</span>
          </div>
          <div class="wb-meta">
            <span v-if="wb.chapters?.length">{{ wb.chapters.length }} 章</span>
            <span v-if="wb.wordbookId === currentId" class="wb-current-badge">当前使用</span>
          </div>
          <div class="wb-check" v-if="wb.wordbookId === selectedId">✓</div>
        </div>
      </div>

      <div class="wb-actions">
        <button class="wb-btn wb-btn-confirm" @click="confirmSelection" :disabled="selectedId === currentId">
          确认切换
        </button>
        <button class="wb-btn wb-btn-cancel" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getWordbooks, getSelectedWordbook, setSelectedWordbook } from '@/api/vocabulary'

const emit = defineEmits(['close', 'changed'])

const wordbooks = ref([])
const loading = ref(true)
const error = ref('')
const selectedId = ref('')
const currentId = ref(getSelectedWordbook())

onMounted(async () => {
  currentId.value = getSelectedWordbook()
  selectedId.value = currentId.value
  try {
    const res = await getWordbooks()
    if (res?.success) {
      wordbooks.value = res.data || []
      if (!wordbooks.value.some(w => w.wordbookId === 'cet4')) {
        wordbooks.value.unshift({ wordbookId: 'cet4', name: 'CET-4 核心词库', total: 0, chapters: [] })
      }
    } else {
      error.value = '获取词库列表失败'
    }
  } catch (e) {
    error.value = '网络连接失败'
  } finally {
    loading.value = false
  }
})

function formatName(name) {
  const map = {
    'CET-4 核心词库': '🎓 CET-4 核心词库',
    'CET-6 核心词库': '🏅 CET-6 核心词库',
    '考研核心词库': '📖 考研核心词库',
    '自定义词书': '✏️ 自定义词书',
    'cet4': '🎓 CET-4 核心词库',
    'cet6': '🏅 CET-6 核心词库'
  }
  return map[name] || map[name] || `📚 ${name}`
}

function selectWordbook(id) {
  selectedId.value = id
}

function confirmSelection() {
  if (selectedId.value !== currentId.value) {
    setSelectedWordbook(selectedId.value)
    currentId.value = selectedId.value
    emit('changed', selectedId.value)
  }
  emit('close')
}
</script>

<style scoped>
.wordbook-overlay {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(0,0,0,0.55);
  display: grid; place-items: center;
}
.wordbook-panel {
  background: linear-gradient(180deg, #3a6b1e, #2d5016);
  border: 3px solid #8b6914; border-radius: 12px;
  padding: 24px; width: min(460px, 90vw); max-height: 80vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.wb-title { font-size: 22px; color: #ffc847; text-align: center; margin: 0 0 4px; }
.wb-desc { font-size: 12px; color: #c4b99a; text-align: center; margin: 0 0 16px; }
.wb-loading, .wb-error { text-align: center; color: #f5edd6; padding: 20px; }
.wb-list { display: flex; flex-direction: column; gap: 8px; }
.wb-card {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(255,255,255,0.08); border: 2px solid transparent;
  border-radius: 8px; padding: 12px 16px; cursor: pointer; transition: all .2s;
  color: #f5edd6;
}
.wb-card:hover { background: rgba(255,255,255,0.15); }
.wb-selected { border-color: #ffc847; background: rgba(255,200,71,0.12); }
.wb-info { display: flex; flex-direction: column; gap: 2px; }
.wb-name { font-size: 15px; font-weight: bold; }
.wb-count { font-size: 12px; color: #c4b99a; }
.wb-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; color: #a0b88a; }
.wb-current-badge {
  background: #5b8c3e; color: #f5edd6; padding: 2px 8px; border-radius: 10px;
  font-size: 10px;
}
.wb-check { font-size: 20px; color: #ffc847; min-width: 24px; text-align: right; }
.wb-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: center; }
.wb-btn {
  padding: 10px 28px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 14px; font-family: 'Microsoft YaHei'; font-weight: bold;
}
.wb-btn-confirm { background: #5b8c3e; color: #f5edd6; }
.wb-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.wb-btn-cancel { background: rgba(255,255,255,0.1); color: #c4b99a; }
</style>
