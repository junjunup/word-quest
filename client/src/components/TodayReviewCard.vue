<template>
  <section class="today-review-card">
    <div class="review-card-header">
      <div>
        <p class="eyebrow">今日复习</p>
        <h3>遗忘曲线任务</h3>
      </div>
      <span class="review-count">{{ totalCount }}</span>
    </div>

    <div v-if="loading" class="review-state">正在生成今日复习队列...</div>
    <div v-else-if="error" class="review-state warning">{{ error }}</div>
    <div v-else-if="totalCount === 0" class="review-state success">
      今天暂时没有高优先级复习词，继续闯关保持手感吧！
    </div>
    <template v-else>
      <div class="review-summary-grid">
        <div class="summary-item">
          <strong>{{ averageMastery }}%</strong>
          <span>平均掌握度</span>
        </div>
        <div class="summary-item">
          <strong>{{ staleCount }}</strong>
          <span>久未复习</span>
        </div>
        <div class="summary-item">
          <strong>{{ weakCount }}</strong>
          <span>薄弱词</span>
        </div>
      </div>

      <div class="reason-tags" aria-label="复习原因分布">
        <span v-for="reason in topReasons" :key="reason.key" class="reason-tag">
          {{ reasonLabel(reason.key) }} ×{{ reason.count }}
        </span>
      </div>

      <ul class="preview-list">
        <li v-for="item in previewItems" :key="item.wordId || item.word">
          <span class="word">{{ item.word }}</span>
          <span class="mastery">{{ normalizeMastery(item.masteryScore) }}%</span>
        </li>
      </ul>
    </template>

    <button class="btn btn-primary review-action" :disabled="totalCount === 0" @click="$emit('start-review')">
      {{ totalCount > 0 ? '开始今日复习' : '暂无复习任务' }}
    </button>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

defineEmits(['start-review'])

const reasonLabels = {
  wrong: '答错',
  near: '接近',
  low_mastery: '低掌握',
  stale: '久未复习',
  fallback: '待巩固'
}

const totalCount = computed(() => props.items.length)
const previewItems = computed(() => props.items.slice(0, 5))
const staleCount = computed(() => props.items.filter(item => item.reasons?.includes('stale')).length)
const weakCount = computed(() => props.items.filter(item => item.reasons?.some(r => ['wrong', 'near', 'low_mastery'].includes(r))).length)
const averageMastery = computed(() => {
  if (props.items.length === 0) return 0
  const sum = props.items.reduce((acc, item) => acc + normalizeMastery(item.masteryScore), 0)
  return Math.round(sum / props.items.length)
})

const topReasons = computed(() => {
  const counter = new Map()
  for (const item of props.items) {
    const reasons = Array.isArray(item.reasons) && item.reasons.length > 0 ? item.reasons : ['fallback']
    for (const reason of reasons) counter.set(reason, (counter.get(reason) || 0) + 1)
  }
  return Array.from(counter.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
})

function normalizeMastery(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(Math.round(number), 100))
}

function reasonLabel(reason) {
  return reasonLabels[reason] || reason
}
</script>

<style scoped lang="scss">
.today-review-card {
  background: linear-gradient(135deg, rgba(255, 200, 71, 0.14), rgba(91, 140, 62, 0.16));
  border: 1px solid rgba(255, 200, 71, 0.35);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
}

.review-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h3 { color: #ffd700; font-size: 20px; margin: 2px 0 0; }
}

.eyebrow {
  color: #c4b99a;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.review-count {
  min-width: 52px;
  height: 52px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #5b8c3e;
  border: 3px solid #3a6b1e;
  color: #fff;
  font-size: 22px;
  font-weight: 800;
}

.review-state {
  color: #f5edd6;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 12px;

  &.success { color: #9be66d; }
  &.warning { color: #ffb37a; }
}

.review-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.summary-item {
  background: rgba(0, 0, 0, 0.16);
  border-radius: 10px;
  padding: 10px;
  text-align: center;

  strong { color: #ffd700; display: block; font-size: 18px; }
  span { color: #c4b99a; font-size: 12px; }
}

.reason-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.reason-tag {
  background: rgba(74, 144, 217, 0.16);
  border: 1px solid rgba(74, 144, 217, 0.35);
  color: #9dccff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
}

.preview-list {
  list-style: none;
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.preview-list li {
  display: flex;
  justify-content: space-between;
  color: #f5edd6;
  font-size: 13px;
}

.mastery { color: #9be66d; }
.review-action { width: 100%; min-height: 44px; }

@media (max-width: 480px) {
  .today-review-card { padding: 14px; }
  .review-summary-grid { grid-template-columns: 1fr; }
  .review-card-header h3 { font-size: 17px; }
}
</style>
