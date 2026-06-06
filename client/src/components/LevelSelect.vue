<template>
  <div class="level-select-overlay">
    <div class="level-select-panel">
      <!-- Header -->
      <div class="ls-header">
        <button class="ls-back-btn" @click="$emit('back')">← 返回</button>
        <h2 class="ls-title">🗺️ 关卡选择</h2>
        <button class="ls-review-btn" @click="showReview = true">📝 错词复习</button>
        <button class="ls-review-btn endless" @click="showEndless = true">♾️ 无尽模式</button>
        <div class="ls-stars-total">⭐ {{ totalStars }}/{{ maxStars }}</div>
      </div>

      <div class="ls-body">
        <!-- Loading state -->
        <div class="ls-loading" v-if="loading">
          <div class="loading-spinner">🌿</div>
          <p>正在加载关卡数据...</p>
        </div>

        <!-- Error state -->
        <div class="ls-error" v-else-if="loadError">
          <div class="error-icon">⚠️</div>
          <p class="error-msg">{{ loadError }}</p>
          <button class="btn btn-primary" @click="loadLevelsData">🔄 重试</button>
        </div>

        <!-- Left: Chapter list -->
        <div class="ls-chapters" v-if="!loading && !loadError">
          <div
            v-for="chapter in chapters"
            :key="chapter.id"
            class="chapter-card"
            :class="{
              active: selectedChapter?.id === chapter.id,
              locked: !chapter.unlocked
            }"
            :style="chapter.unlocked ? { borderColor: chapter.color } : {}"
            @click="selectChapter(chapter)"
          >
            <div class="chapter-icon" :style="{ background: chapter.unlocked ? chapter.color : '#666' }">
              {{ chapter.unlocked ? chapter.id : '🔒' }}
            </div>
            <div class="chapter-info">
              <div class="chapter-name">{{ chapter.name }}</div>
              <div class="chapter-theme">{{ chapter.theme }}</div>
              <div class="chapter-stars" v-if="chapter.unlocked">
                <span>⭐ {{ getChapterStars(chapter) }}/{{ chapter.levels.length * 3 }}</span>
                <div class="mini-progress">
                  <div class="mini-progress-fill" :style="{ width: (getChapterStars(chapter) / (chapter.levels.length * 3) * 100) + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Level grid -->
        <div class="ls-levels" v-if="!loading && !loadError">
          <div class="ls-chapter-header" v-if="selectedChapter">
            <h3 :style="{ color: selectedChapter.color }">{{ selectedChapter.name }}</h3>
            <p class="chapter-desc">{{ selectedChapter.description }}</p>
            <p class="chapter-progress">共 {{ selectedChapter.levels.length }} 关 · 已获 ⭐ {{ getChapterStars(selectedChapter) }}/{{ selectedChapter.levels.length * 3 }}</p>
            <div class="chapter-progress-bar">
              <div class="progress-fill" :style="{ width: (getChapterStars(selectedChapter) / (selectedChapter.levels.length * 3) * 100) + '%' }"></div>
            </div>
          </div>

          <div class="level-segments" v-if="levelSegments.length > 1" role="tablist" aria-label="关卡分段">
            <button
              v-for="segment in levelSegments"
              :key="segment.index"
              type="button"
              class="segment-btn"
              :class="{ active: levelSegment === segment.index }"
              @click="levelSegment = segment.index"
            >
              {{ segment.label }}
            </button>
          </div>

          <div class="level-grid" v-if="selectedChapter">
            <div
              v-for="level in visibleLevels"
              :key="level.id"
              class="level-card"
              :class="{
                active: selectedLevel?.id === level.id,
                locked: !level.unlocked,
                completed: level.completed
              }"
              @click="selectLevel(level)"
            >
              <div class="level-number">{{ level.id }}</div>
              <div class="level-name">{{ level.name }}</div>
              <div class="level-stars" v-if="level.completed">
                <span v-for="s in 3" :key="s" :class="{ filled: s <= level.stars }">⭐</span>
              </div>
              <div class="level-score" v-if="level.highScore > 0">{{ level.highScore }}分</div>
              <div class="level-boss" v-if="level.bossType">👹</div>
              <div class="level-lock" v-if="!level.unlocked">🔒</div>
            </div>
          </div>

          <!-- Bottom: Selected level detail + difficulty + start -->
          <div class="ls-footer" v-if="selectedLevel && selectedLevel.unlocked">
            <div class="selected-detail">
              <span class="detail-name">{{ selectedChapter.name }} - {{ selectedLevel.name }}</span>
              <span class="detail-words">📝 {{ selectedLevel.wordsCount }}词</span>
              <span class="detail-boss" v-if="selectedLevel.bossType">👹 含Boss</span>
            </div>

            <div class="difficulty-selector">
              <button
                v-for="diff in difficulties"
                :key="diff.key"
                class="diff-btn"
                :class="{ active: selectedDifficulty === diff.key }"
                @click="selectedDifficulty = diff.key"
              >
                <span class="diff-icon">{{ diff.icon }}</span>
                <span class="diff-label">{{ diff.label }}</span>
                <span class="diff-desc">{{ diff.desc }}</span>
              </button>
            </div>

            <button class="start-btn" @click="startLevel">
              ⚔️ 开始挑战
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 错词复习弹窗 -->
    <ReviewMode v-if="showReview" @close="showReview = false" />

    <!-- 无尽模式弹窗 -->
    <EndlessMode v-if="showEndless" @close="showEndless = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getLevelsStatus } from '@/api/game'
import ReviewMode from '@/components/ReviewMode.vue'
import EndlessMode from '@/components/EndlessMode.vue'

const showReview = ref(false)
const showEndless = ref(false)

const emit = defineEmits(['start', 'back'])

const chapters = ref([])
const selectedChapter = ref(null)
const selectedLevel = ref(null)
const savedDiff = localStorage.getItem('wordquest:difficulty')
const selectedDifficulty = ref(
  (savedDiff && ['easy', 'normal', 'hard'].includes(savedDiff)) ? savedDiff : 'normal'
)
const loading = ref(true)
const loadError = ref('')
const levelSegment = ref(0)
const LEVELS_PER_SEGMENT = 10

const difficulties = [
  { key: 'easy', icon: '🌱', label: '简单', desc: '35秒/4命/0.8x' },
  { key: 'normal', icon: '⚔️', label: '普通', desc: '30秒/3命/1.0x' },
  { key: 'hard', icon: '🔥', label: '困难', desc: '20秒/2命/1.5x' }
]

const totalStars = computed(() => {
  let total = 0
  for (const ch of chapters.value) {
    for (const lv of ch.levels) {
      total += lv.stars || 0
    }
  }
  return total
})

const maxStars = computed(() => {
  return chapters.value.reduce((sum, ch) => sum + ch.levels.length * 3, 0)
})

const levelSegments = computed(() => {
  if (!selectedChapter.value?.levels?.length) return []
  const total = selectedChapter.value.levels.length
  return Array.from({ length: Math.ceil(total / LEVELS_PER_SEGMENT) }, (_, index) => {
    const start = index * LEVELS_PER_SEGMENT + 1
    const end = Math.min((index + 1) * LEVELS_PER_SEGMENT, total)
    return { index, start, end, label: `${start}-${end}关` }
  })
})

const visibleLevels = computed(() => {
  if (!selectedChapter.value?.levels?.length) return []
  const start = levelSegment.value * LEVELS_PER_SEGMENT
  return selectedChapter.value.levels.slice(start, start + LEVELS_PER_SEGMENT)
})

const currentSegmentLabel = computed(() => {
  return levelSegments.value.find(segment => segment.index === levelSegment.value)?.label || '全部关卡'
})

function getChapterStars(chapter) {
  return chapter.levels.reduce((sum, lv) => sum + (lv.stars || 0), 0)
}

function selectChapter(chapter) {
  if (!chapter.unlocked) return
  selectedChapter.value = chapter
  const firstUnlockedLevel = chapter.levels.find(l => l.unlocked)
  selectedLevel.value = firstUnlockedLevel || null
  const selectedIndex = Math.max(0, chapter.levels.findIndex(level => level.id === selectedLevel.value?.id))
  levelSegment.value = Math.floor(selectedIndex / LEVELS_PER_SEGMENT)
}

function selectLevel(level) {
  if (!level.unlocked) return
  selectedLevel.value = level
}

function startLevel() {
  if (!selectedChapter.value || !selectedLevel.value) return
  emit('start', {
    chapter: selectedChapter.value.id,
    level: selectedLevel.value.id,
    difficulty: selectedDifficulty.value
  })
}

onMounted(async () => {
  await loadLevelsData()
})

async function loadLevelsData() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getLevelsStatus()
    if (res.data?.chapters) {
      chapters.value = res.data.chapters
      // Auto-select first unlocked chapter
      const firstUnlocked = chapters.value.find(c => c.unlocked)
      if (firstUnlocked) {
        selectedChapter.value = firstUnlocked
        // 自动选中该章节第一个已解锁的关卡，让"开始挑战"按钮立即可见
        const firstUnlockedLevel = firstUnlocked.levels.find(l => l.unlocked)
        if (firstUnlockedLevel) {
          selectedLevel.value = firstUnlockedLevel
          const selectedIndex = Math.max(0, firstUnlocked.levels.findIndex(level => level.id === firstUnlockedLevel.id))
          levelSegment.value = Math.floor(selectedIndex / LEVELS_PER_SEGMENT)
        }
      }
    }
  } catch (e) {
    console.warn('加载关卡状态失败:', e)
    loadError.value = e?.message || '加载关卡失败，请检查网络连接或重新登录'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.level-select-overlay {
  position: fixed;
  inset: 0;
  background: rgba(45, 80, 22, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

.level-select-panel {
  width: 900px;
  max-width: 95vw;
  max-height: 90vh;
  background: linear-gradient(180deg, #e8d5a3 0%, #d4a76a 100%);
  border: 4px solid #8b6914;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.ls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(91, 58, 26, 0.9);
  border-bottom: 3px solid #8b6914;
}

.ls-back-btn {
  background: none;
  border: 2px solid #8b6914;
  color: #f5edd6;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  &:hover { background: rgba(255, 255, 255, 0.1); }
}

.ls-review-btn {
  background: #5b8c3e;
  border: 2px solid #3a6b1e;
  color: #f5edd6;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  &:hover { background: #6b9c4e; }
  &.endless {
    background: #8b6914;
    border-color: #6b5010;
    &:hover { background: #a07a1e; }
  }
}

.ls-title {
  color: #ffc847;
  font-size: 24px;
  font-family: 'Microsoft YaHei', sans-serif;
}

.ls-stars-total {
  color: #ffc847;
  font-size: 16px;
  font-weight: bold;
}

.ls-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.ls-chapters {
  width: 260px;
  padding: 16px;
  overflow-y: auto;
  border-right: 3px solid #8b6914;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chapter-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid #8b6914;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.locked) {
    background: rgba(255, 255, 255, 0.5);
    transform: translateX(4px);
  }

  &.active {
    background: rgba(255, 200, 71, 0.3);
    border-width: 3px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  &.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.chapter-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  flex-shrink: 0;
}

.chapter-info {
  flex: 1;
  min-width: 0;
}

.chapter-name {
  font-weight: bold;
  color: #5b3a1a;
  font-size: 14px;
}

.chapter-theme {
  color: #8b6914;
  font-size: 11px;
  margin-top: 2px;
}

.chapter-stars {
  color: #e8a33c;
  font-size: 11px;
  margin-top: 2px;
  display: flex; flex-direction: column; gap: 4px;
}

.mini-progress, .chapter-progress-bar {
  width: 100%; height: 6px; background: rgba(0,0,0,.25);
  border-radius: 3px; overflow: hidden;
}
.mini-progress-fill, .progress-fill {
  height: 100%; background: linear-gradient(90deg, #ffc847, #ffd700);
  border-radius: 3px; transition: width 0.5s ease;
  min-width: 0;
}
.chapter-progress-bar { height: 10px; margin-bottom: 12px; }

.ls-levels {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.ls-chapter-header {
  margin-bottom: 16px;

  h3 {
    font-size: 20px;
    margin-bottom: 4px;
  }

  .chapter-desc {
    color: #8b6914;
    font-size: 13px;
  }

  .chapter-progress {
    color: #6b5010;
    font-size: 12px;
    margin-top: 6px;
  }
}

.level-segments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.segment-btn {
  min-height: 44px;
  padding: 8px 12px;
  border: 2px solid #8b6914;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.32);
  color: #5b3a1a;
  font-weight: bold;
  cursor: pointer;

  &.active,
  &:hover {
    background: rgba(255, 200, 71, 0.42);
    border-color: #ffc847;
  }
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.level-card {
  position: relative;
  background: rgba(255, 255, 255, 0.4);
  border: 2px solid #8b6914;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:hover:not(.locked) {
    background: rgba(255, 200, 71, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.active {
    border-color: #ffc847;
    border-width: 3px;
    background: rgba(255, 200, 71, 0.3);
  }

  &.locked {
    opacity: 0.4;
    cursor: not-allowed;
    background: rgba(128, 128, 128, 0.2);
  }

  &.completed {
    background: rgba(91, 140, 62, 0.2);
  }
}

.level-number {
  font-size: 24px;
  font-weight: bold;
  color: #5b3a1a;
  font-family: 'Press Start 2P', monospace;
}

.level-name {
  font-size: 11px;
  color: #8b6914;
  font-weight: bold;
}

.level-stars {
  font-size: 10px;
  span { opacity: 0.3; }
  span.filled { opacity: 1; }
}

.level-score {
  font-size: 10px;
  color: #e8a33c;
}

.level-boss {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 14px;
}

.level-lock {
  font-size: 20px;
}

.ls-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 2px solid rgba(139, 105, 20, 0.3);
}

.selected-detail {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #5b3a1a;

  .detail-name { font-weight: bold; }
  .detail-words { color: #8b6914; }
  .detail-boss { color: #d45b3e; font-weight: bold; }
}

.difficulty-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.diff-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid #8b6914;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { background: rgba(255, 255, 255, 0.5); }

  &.active {
    background: rgba(255, 200, 71, 0.4);
    border-color: #ffc847;
    border-width: 3px;
    box-shadow: 0 2px 8px rgba(255, 200, 71, 0.3);
  }

  .diff-icon { font-size: 20px; }
  .diff-label { font-size: 14px; font-weight: bold; color: #5b3a1a; }
  .diff-desc { font-size: 10px; color: #8b6914; }
}

.start-btn {
  width: 100%;
  min-height: 52px;
  padding: 14px;
  background: #5b8c3e;
  border: 3px solid #3a6b1e;
  border-radius: 8px;
  color: #f5edd6;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #6b9c4e;
    border-color: #ffc847;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ls-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 60px 0;
  color: #8b6914;
  font-size: 16px;

  .loading-spinner {
    font-size: 40px;
    animation: spin 2s linear infinite;
    margin-bottom: 16px;
  }
}

.ls-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 60px 20px;
  text-align: center;

  .error-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .error-msg {
    color: #d45b3e;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 16px;
    line-height: 1.6;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .level-select-overlay {
    align-items: stretch;
    justify-content: stretch;
  }

  .level-select-panel {
    width: 100vw;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }

  .ls-header {
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
  }

  .ls-back-btn,
  .ls-review-btn {
    min-height: 44px;
    padding: 8px 12px;
  }

  .ls-title {
    order: -1;
    width: 100%;
    font-size: 20px;
    text-align: center;
  }

  .ls-body {
    flex-direction: column;
    overflow-y: auto;
  }

  .ls-chapters {
    width: 100%;
    max-height: 178px;
    border-right: 0;
    border-bottom: 3px solid #8b6914;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chapter-card:hover:not(.locked) {
    transform: none;
  }

  .ls-levels {
    min-height: 0;
    overflow: visible;
  }

  .level-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .selected-detail,
  .difficulty-selector {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 430px) {
  .ls-header {
    padding: 10px;
  }

  .ls-stars-total {
    width: 100%;
    text-align: center;
  }

  .ls-chapters {
    grid-template-columns: 1fr;
    max-height: 150px;
    padding: 10px;
  }

  .ls-levels {
    padding: 10px;
  }

  .level-segments {
    gap: 6px;
  }

  .segment-btn {
    flex: 1 1 30%;
    padding: 8px 6px;
    font-size: 12px;
  }

  .level-grid {
    gap: 8px;
  }

  .level-card {
    min-height: 92px;
    padding: 10px 6px;
  }

  .level-number {
    font-size: 20px;
  }
}
</style>
