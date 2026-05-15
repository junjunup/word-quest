<template>
  <section class="vocab-import-panel">
    <div class="panel-header">
      <div>
        <p class="eyebrow">词库扩展</p>
        <h3>自定义 CET 词库导入</h3>
      </div>
      <span class="status-pill" :class="lastReport?.isValid ? 'ok' : 'warn'">
        {{ lastReport ? (lastReport.isValid ? '可导入' : '需修正') : '待校验' }}
      </span>
    </div>

    <p class="help-text">
      支持 JSON 数组，字段需包含 word、meaning、example、difficulty(1-5)、chapter(1-6)、level(1-30)。
      当前导入目标：<strong>{{ wordbookName }}</strong>（{{ wordbookId }}）。建议先 dry-run 校验，再执行导入。
    </p>

    <div class="import-actions">
      <label class="file-btn">
        选择 JSON 文件
        <input type="file" accept=".json,application/json" @change="onFileChange" />
      </label>
      <button class="btn btn-primary" @click="runDryRun" :disabled="loading || parsedWords.length === 0">Dry-run 校验</button>
      <button class="btn btn-gold" @click="runImport" :disabled="loading || !lastReport?.isValid">确认导入</button>
    </div>

    <textarea
      v-model="rawText"
      class="json-input"
      placeholder='示例：[{
  "word":"abandon",
  "meaning":"放弃",
  "example":"Never abandon your goal.",
  "difficulty":2,
  "chapter":1,
  "level":1
}]'
      @input="parseRawText"
    />

    <p v-if="parseError" class="error-text">{{ parseError }}</p>
    <p v-if="message" class="message-text">{{ message }}</p>

    <div v-if="lastReport" class="report-grid">
      <div><strong>{{ lastReport.total }}</strong><span>词数</span></div>
      <div><strong>{{ lastReport.duplicates?.length || 0 }}</strong><span>重复</span></div>
      <div><strong>{{ lastReport.missingFields?.length || 0 }}</strong><span>缺字段</span></div>
      <div><strong>{{ lastReport.invalidRanges?.length || 0 }}</strong><span>范围错</span></div>
      <div><strong>{{ lastReport.emptyLevels?.length || 0 }}</strong><span>空关卡</span></div>
    </div>

    <details v-if="lastReport" class="report-detail">
      <summary>查看前 10 条问题</summary>
      <pre>{{ issuePreview }}</pre>
    </details>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { importVocabulary } from '@/api/vocabulary'

const props = defineProps({
  wordbookId: { type: String, default: 'cet4' },
  wordbookName: { type: String, default: 'CET-4 核心词库' }
})

const emit = defineEmits(['imported'])

const rawText = ref('')
const parsedWords = ref([])
const parseError = ref('')
const loading = ref(false)
const message = ref('')
const lastReport = ref(null)

const issuePreview = computed(() => {
  if (!lastReport.value) return ''
  return JSON.stringify({
    duplicates: (lastReport.value.duplicates || []).slice(0, 10),
    missingFields: (lastReport.value.missingFields || []).slice(0, 10),
    invalidRanges: (lastReport.value.invalidRanges || []).slice(0, 10),
    emptyLevels: (lastReport.value.emptyLevels || []).slice(0, 10)
  }, null, 2)
})

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.words)) return payload.words
  return []
}

function parseRawText() {
  parseError.value = ''
  lastReport.value = null
  message.value = ''
  if (!rawText.value.trim()) {
    parsedWords.value = []
    return
  }
  try {
    parsedWords.value = normalizePayload(JSON.parse(rawText.value))
    if (parsedWords.value.length === 0) parseError.value = 'JSON 中未找到词库数组'
  } catch (e) {
    parsedWords.value = []
    parseError.value = 'JSON 解析失败：' + e.message
  }
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    rawText.value = String(reader.result || '')
    parseRawText()
  }
  reader.readAsText(file, 'utf-8')
}

async function runDryRun() {
  await submit(true)
}

async function runImport() {
  if (!window.confirm('确认将校验通过的词库 upsert 导入数据库？')) return
  await submit(false)
}

async function submit(dryRun) {
  loading.value = true
  message.value = ''
  try {
    const res = await importVocabulary(parsedWords.value, dryRun, { wordbookId: props.wordbookId, wordbookName: props.wordbookName })
    const data = res.data || {}
    lastReport.value = data.report || null
    message.value = dryRun
      ? (lastReport.value?.isValid ? '校验通过，可以导入。' : '校验发现问题，请修正后再导入。')
      : `导入完成：新增 ${data.upserted || 0}，更新 ${data.modified || 0}，匹配 ${data.matched || 0}`
    if (!dryRun) emit('imported')
  } catch (e) {
    lastReport.value = e?.data?.report || null
    message.value = e?.message || '提交失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.vocab-import-panel {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.panel-header,
.import-actions,
.report-grid {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-header {
  justify-content: space-between;
  margin-bottom: 10px;
  h3 { color: #ffd700; margin-top: 2px; }
}

.eyebrow { color: #c4b99a; font-size: 12px; letter-spacing: 0.12em; }
.help-text { color: #b8b8d4; font-size: 13px; line-height: 1.6; margin-bottom: 12px; }

.status-pill {
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(232, 163, 60, 0.2);
  color: #f0b04a;
  &.ok { background: rgba(91, 140, 62, 0.2); color: #9be66d; }
}

.import-actions { flex-wrap: wrap; margin-bottom: 12px; }
.file-btn {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border: 2px solid #8b6914;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f5edd6;
  cursor: pointer;
  input { display: none; }
}

.json-input {
  width: 100%;
  min-height: 180px;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.2);
  color: #f5edd6;
  padding: 12px;
  font-family: Consolas, monospace;
  font-size: 13px;
}

.error-text { color: #ff8866; margin-top: 8px; }
.message-text { color: #9be66d; margin-top: 8px; }

.report-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-top: 12px;
  div { background: rgba(0,0,0,0.16); border-radius: 8px; padding: 10px; text-align: center; }
  strong { display: block; color: #ffd700; font-size: 18px; }
  span { color: #888; font-size: 12px; }
}

.report-detail {
  margin-top: 12px;
  color: #b8b8d4;
  pre { overflow-x: auto; font-size: 12px; }
}

@media (max-width: 640px) {
  .report-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
