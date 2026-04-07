# 词汇大冒险 — 全面修复实施计划

## 背景

游戏设计审查报告（GAME_DESIGN_AUDIT.md）识别了 16 个问题，综合评级 B-（65/100）。本计划覆盖所有 P0（必修）+ P1（强烈建议）+ P2（锦上添花）改进项，按依赖关系排列执行顺序。

## 执行概览

```
Phase 1 — P0 关键修复（~5小时）
  ├─ P0-2: 修复 4 个死成就          [30分钟]  无依赖
  ├─ P0-3: Boss多轮答题              [15分钟]  无依赖
  ├─ P0-4: 统一计分公式              [30分钟]  无依赖
  └─ P0-1: 多题型实现                [3-4小时] 无依赖（最大项）

Phase 2 — P1 体验提升（~8小时）
  ├─ P1-8: 自适应难度接入            [30分钟]  依赖 P0-1
  ├─ P1-9: 死亡螺旋保护              [1小时]   依赖 P1-8
  ├─ P1-7: 教程关设计                [1.5小时] 无依赖
  ├─ P1-5: 音效系统                  [2-3小时] 无依赖
  └─ P1-6: 地图章节差异化            [2小时]   无依赖

Phase 3 — P2 锦上添花（~6小时）
  ├─ P2-15: 删除废弃 BattleScene     [10分钟]  无依赖
  ├─ P2-13: 错词复习模式             [2-3小时] 依赖 P0-1
  ├─ P2-10: 无尽模式                 [2-3小时] 依赖 P0-1, P1-6
  └─ P2-14: 交互式新手引导           [2小时]   依赖 P1-7
```

---

## Phase 1: P0 关键修复

---

### P0-2: 修复 4 个永远不触发的成就

**问题**: `achievementContext.npcChats` 从未自增；`achievementContext.loginStreak` 从未从服务端同步。导致 login_3/login_7/login_30/npc_friend 四个成就永不触发。

**修改文件**: `client/src/views/GameView.vue`

**改动 1 — 修复 npcChats（第610行 `closeChatPanel`）**:
```js
// 当前代码
function closeChatPanel() {
  showChatPanel.value = false
  eventBus.emit(EVENTS.CHAT_CLOSED)
}

// 改为
function closeChatPanel() {
  showChatPanel.value = false
  achievementContext.npcChats++                     // 新增
  scoreSystem.checkAchievements(achievementContext)  // 新增
  eventBus.emit(EVENTS.CHAT_CLOSED)
}
```

**改动 2 — 修复 loginStreak（`onMounted` 第354行之后）**:
在 `await gameStore.loadProgress()` 之后添加：
```js
// 同步 loginStreak
const userStore = useUserStore()
try {
  await userStore.fetchUserInfo()
  if (userStore.userInfo?.loginStreak) {
    achievementContext.loginStreak = userStore.userInfo.loginStreak
  }
} catch (e) {
  console.warn('获取用户信息失败:', e)
}

// 加载已获得的成就，防止重复触发
if (gameStore.progress?.achievements?.length) {
  scoreSystem.loadAchievements(gameStore.progress.achievements.map(a => a.id))
}
scoreSystem.checkAchievements(achievementContext)
```

**验证**: 
- MongoDB 中设置用户 loginStreak=3 → 进入游戏 → "三天打鱼"成就弹出
- 与 NPC 对话并关闭 10 次 → "小智的朋友"成就弹出
- 刷新页面后已获得的成就不重复弹出

---

### P0-3: Boss 多轮答题（匹配 Boss HP）

**问题**: `WorldScene.js` 第183行硬编码 `questionsNeeded: 1`，Boss 战与普通怪无区别。

**修改文件**: `client/src/game/scenes/WorldScene.js`

**改动（第183行）**:
```js
// 当前
questionsNeeded: 1,

// 改为
questionsNeeded: boss.hp,
```

**原理**: `BossQuizModal.vue` 已完整支持多轮答题逻辑：
- 第82行 `currentHp = ref(props.bossHp)` — 接收 `questionsNeeded` 作为 HP
- 第188行 答对 → `currentHp--`
- 第189行 `currentHp <= 0` → `bossDefeated = true`
- 第208-213行 `nextQuestion()` 未击败则加载下一题
- 正确答案数和错误数都传回 WorldScene

**验证**:
- Ch1-Lv1 Boss（贪吃牛魔 baseHp=3）：需连续答对3题才能击败
- Hard 难度（baseHp+2=5）：需答对5题
- 答错扣命但不结束 Boss 战，继续下一题
- Boss HP 条准确显示剩余血量

---

### P0-4: 统一客户端/服务端计分公式

**问题**: 客户端 `helpers.js` 缺少 <3秒 +50 的时间加成；服务端 `scoringService.js` 有但从未被调用（死代码）。

**修改文件 1**: `client/src/utils/helpers.js`（第14-19行）

```js
// 当前
export function calculateScore(isCorrect, responseTime, combo, difficulty) {
  if (!isCorrect) return 0
  const baseScore = 100 * difficulty
  const comboBonus = Math.min(combo * 10, 50)
  const timeBonus = responseTime < 5000 ? 30 : responseTime < 10000 ? 15 : 0
  return baseScore + comboBonus + timeBonus
}

// 改为（与服务端 scoringService.js 对齐）
export function calculateScore(isCorrect, responseTime, combo, difficulty, hintUsed = false) {
  if (!isCorrect) return 0
  let baseScore = 100 * difficulty
  if (hintUsed) baseScore = Math.floor(baseScore * 0.5)
  const comboBonus = Math.min(combo * 10, 50)
  let timeBonus = 0
  if (responseTime < 3000) timeBonus = 50       // 新增：3秒内 +50
  else if (responseTime < 5000) timeBonus = 30
  else if (responseTime < 10000) timeBonus = 15
  return baseScore + comboBonus + timeBonus
}
```

**修改文件 2**: `client/src/views/GameView.vue`（第508行）
```js
// 当前
const baseScore = calculateScore(isCorrect, responseTime, levelManager.combo, currentDifficulty.value)

// 改为（预留 hintUsed 参数）
const baseScore = calculateScore(isCorrect, responseTime, levelManager.combo, currentDifficulty.value, false)
```

**验证**:
- 3秒内答对 → 得分包含 +50 时间加成（之前只有 +30）
- `speed_demon` 成就（3秒内答对）的分数奖励与判定阈值一致

---

### P0-1: 实现多种题型

**问题**: 前端只实现了 `choice_en2cn`（英→中4选1），自适应引擎定义的 5 种题型中 2-5 级的 UI 完全没有实现。

**需实现的题型**:
| 难度 | 题型 ID | 描述 | UI 形式 |
|------|---------|------|---------|
| 1 | `choice_en2cn` | 英→中选择 | 4个按钮（已有） |
| 2 | `choice_cn2en` | 中→英选择 | 4个按钮（显示中文，选英文） |
| 3 | `spell_hint` | 带提示拼写 | 输入框 + 首字母提示 |
| 4 | `spell_full` | 完整拼写 | 输入框（无提示） |
| 5 | `translate` | 翻译 | 输入框（看中文写英文） |

#### 修改文件 1: `client/src/components/QuizModal.vue`

**新增 props**:
```js
questionType: { type: String, default: 'choice_en2cn' }
```

**模板改造** — 替换第16-41行的固定选择题模板，改为条件渲染：

```vue
<!-- 单词/释义展示区 -->
<div class="word-display">
  <!-- choice_en2cn / spell_hint: 显示英文单词 -->
  <template v-if="['choice_en2cn', 'spell_hint'].includes(questionType)">
    <h2 class="word-text">{{ wordData?.word }}</h2>
    <p class="phonetic" v-if="wordData?.phonetic">{{ wordData.phonetic }}</p>
  </template>
  <!-- choice_cn2en / spell_full / translate: 显示中文释义 -->
  <template v-else>
    <h2 class="word-text meaning-text">{{ wordData?.meaning }}</h2>
  </template>
</div>

<!-- 题目提示 -->
<p class="quiz-prompt">{{ promptText }}</p>

<!-- 选择题模式 -->
<div class="options-grid" v-if="isChoiceType">
  <button v-for="(option, index) in shuffledOptions" :key="index"
    class="option-btn" :class="{ correct: answered && option.correct, wrong: answered && selectedIndex === index && !option.correct, disabled: answered }"
    @click="selectOption(index, option)" :disabled="answered">
    <span class="option-letter">{{ ['A','B','C','D'][index] }}</span>
    <span class="option-text">{{ option.text }}</span>
  </button>
</div>

<!-- 拼写/翻译输入模式 -->
<div class="input-area" v-else>
  <p class="spell-hint" v-if="questionType === 'spell_hint'">
    💡 提示：{{ hintText }}
  </p>
  <div class="input-row">
    <input ref="spellInput" v-model="typedAnswer"
      @keyup.enter="submitTypedAnswer" :disabled="answered"
      placeholder="输入英文单词..." class="spell-input" autofocus />
    <button class="btn btn-primary submit-btn" @click="submitTypedAnswer"
      :disabled="answered || !typedAnswer.trim()">确认</button>
  </div>
  <!-- 输入题答错后显示正确拼写 -->
  <p v-if="answered && !isCorrect" class="correct-spelling">
    正确拼写：<strong>{{ wordData?.word }}</strong>
  </p>
</div>
```

**新增 script 逻辑**:
```js
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

// 新增计算属性
const isChoiceType = computed(() =>
  ['choice_en2cn', 'choice_cn2en'].includes(props.questionType))

const promptText = computed(() => ({
  choice_en2cn: '请选择正确的中文释义：',
  choice_cn2en: '请选择正确的英文单词：',
  spell_hint:   '请根据提示拼写单词：',
  spell_full:   '请拼写对应的英文单词：',
  translate:    '请输入对应的英文翻译：'
}[props.questionType] || '请选择正确的中文释义：'))

const hintText = computed(() => {
  const w = props.wordData?.word || ''
  return w[0] + '_'.repeat(w.length - 1) + ` (${w.length}个字母)`
})

const typedAnswer = ref('')
const spellInput = ref(null)

function submitTypedAnswer() {
  if (answered.value || !typedAnswer.value.trim()) return
  const answer = typedAnswer.value.trim().toLowerCase()
  const correct = (props.wordData?.word || '').toLowerCase()
  answered.value = true
  isCorrect.value = (answer === correct)
  const responseTime = Date.now() - startTime.value
  clearInterval(timerInterval)

  if (!isCorrect.value) {
    shaking.value = true
    setTimeout(() => shaking.value = false, 500)
  }

  emit('answer', {
    isCorrect: isCorrect.value,
    responseTime,
    answer: typedAnswer.value.trim()
  })
}

// onMounted 中追加自动聚焦
onMounted(() => {
  // ...existing timer code...
  if (!isChoiceType.value) {
    nextTick(() => spellInput.value?.focus())
  }
})
```

**新增 CSS**:
```scss
.meaning-text {
  font-family: 'Microsoft YaHei', sans-serif;
  font-size: 28px;
}
.input-area {
  padding: 0 20px 20px;
}
.spell-hint {
  text-align: center;
  color: #5b8c3e;
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: bold;
  letter-spacing: 2px;
}
.input-row {
  display: flex;
  gap: 10px;
}
.spell-input {
  flex: 1;
  padding: 14px 16px;
  font-size: 18px;
  border: 2px solid #8b6914;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.4);
  color: #5b3a1a;
  &:focus { border-color: #5b8c3e; outline: none; }
}
.submit-btn {
  padding: 14px 24px;
  font-size: 15px;
}
.correct-spelling {
  text-align: center;
  color: #5b8c3e;
  font-size: 15px;
  margin-top: 12px;
  strong { letter-spacing: 1px; }
}
```

#### 修改文件 2: `client/src/components/BossQuizModal.vue`

同样的多题型改造：
- 新增 `questionType` prop（第69行）
- 模板中条件渲染（选择题 vs 输入题）
- `loadQuestion()` 中根据 questionType 构建不同选项：
  - `choice_cn2en`: 选项为英文单词（`word` 字段而非 `meaning`）
  - `spell_*` / `translate`: 不生成选项，显示输入框
- 新增 `submitTypedAnswer` 方法（复用 QuizModal 的逻辑）

#### 修改文件 3: `client/src/views/GameView.vue`

**新增状态**（第155行后）:
```js
const currentQuestionType = ref('choice_en2cn')
const adaptiveQuestionType = ref('choice_en2cn')
```

**传递 questionType 给 QuizModal**（第65-72行）:
```vue
<QuizModal
  v-if="showQuiz"
  :word-data="currentQuizData"
  :difficulty="currentDifficulty"
  :question-type="currentQuestionType"
  :time-limit="gameStore.difficultyConfig.timer"
  @answer="handleQuizAnswer"
  @close="closeQuiz"
/>
```

**传递 questionType 给 BossQuizModal**（第75-85行）:
```vue
<BossQuizModal
  v-if="showBossQuiz"
  ...existing props...
  :question-type="currentQuestionType"
  ...
/>
```

**`onShowQuiz` 中设置题型**（第418行）:
```js
currentQuestionType.value = adaptiveQuestionType.value || 'choice_en2cn'
```

**`buildQuizDataLocal` 扩展**（第474行）— 根据 `currentQuestionType` 构建不同数据:
```js
function buildQuizDataLocal(word, eventData) {
  const qt = currentQuestionType.value

  if (qt === 'choice_cn2en') {
    // 中→英：选项为英文单词
    const otherWords = levelWords.value.filter(w => w.word !== word.word)
    const distractors = shuffle(otherWords).slice(0, 3)
    const options = [
      { id: 'correct', text: word.word, correct: true },
      ...distractors.map(w => ({ id: w._id || w.word, text: w.word, correct: false }))
    ]
    while (options.length < 4) options.push({ id: `filler_${options.length}`, text: '---', correct: false })
    return { ...word, options: shuffle(options), chapter: eventData.chapter, level: eventData.level }
  }

  if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
    // 拼写/翻译题：不需要选项
    return { ...word, options: [], chapter: eventData.chapter, level: eventData.level }
  }

  // 默认 choice_en2cn（保持现有逻辑）
  const otherWords = levelWords.value.filter(w => w.word !== word.word && w.meaning !== word.meaning)
  const shuffledOthers = shuffle(otherWords).slice(0, 3)
  const options = [
    { id: 'correct', text: word.meaning, correct: true },
    ...shuffledOthers.map(w => ({ id: w._id || w.word, text: w.meaning, correct: false }))
  ]
  while (options.length < 4) options.push({ id: `filler_${options.length}`, text: '（无选项）', correct: false })
  return { ...word, options: shuffle(options), chapter: eventData.chapter, level: eventData.level }
}
```

**`buildQuizData` 也需扩展**（第454行）— API 返回数据的构建：
```js
function buildQuizData(question, distractors, eventData) {
  const qt = currentQuestionType.value
  let options

  if (qt === 'choice_cn2en') {
    options = [
      { id: question._id, text: question.word, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.word, correct: false }))
    ]
  } else if (['spell_hint', 'spell_full', 'translate'].includes(qt)) {
    options = []
  } else {
    options = [
      { id: question._id, text: question.meaning, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.meaning, correct: false }))
    ]
  }

  return {
    _id: question._id, word: question.word, meaning: question.meaning,
    phonetic: question.phonetic, example: question.example,
    options: shuffle(options),
    chapter: eventData.chapter, level: eventData.level
  }
}
```

**`handleQuizAnswer` 中更新 questionType**（第560行）:
```js
questionType: currentQuestionType.value,  // 原来硬编码 'choice_en2cn'
```

**验证**:
1. 手动设置 `currentQuestionType = 'choice_cn2en'` → 显示中文释义，4个英文选项
2. 设置 `spell_hint` → 显示输入框 + "a____ (5个字母)" 提示
3. 设置 `spell_full` → 显示中文释义 + 输入框（无提示）
4. 设置 `translate` → 同 spell_full
5. 输入正确单词 → 答对反馈；拼写错误 → 显示正确拼写
6. 倒计时耗尽 → 自动判错（输入题同样生效）
7. Boss 答题弹窗同样支持多题型

---

## Phase 2: P1 体验提升

---

### P1-8: 接入自适应难度

**问题**: `submitQuizRecord` 返回 `adaptiveDifficulty` 但 GameView 的 `.catch()` 吞掉了返回值。

**修改文件**: `client/src/views/GameView.vue`

**改动（第557-571行）** — 将 `.catch()` 改为 `.then().catch()`:
```js
submitQuizRecord({
  wordId: currentQuizData.value?._id || 'unknown',
  word: currentQuizData.value?.word || '',
  questionType: currentQuestionType.value,
  isCorrect, responseTime,
  difficulty: currentDifficulty.value,
  hintUsed: false, npcInteraction: false,
  sessionId: levelManager.sessionId,
  chapter: hudData.chapter, level: hudData.level,
  playerAnswer: answer,
  correctAnswer: currentQuizData.value?.meaning || ''
}).then(res => {
  if (res?.data?.adaptiveDifficulty) {
    const ad = res.data.adaptiveDifficulty
    adaptiveQuestionType.value = ad.questionType || 'choice_en2cn'
    // 可选：也更新难度等级用于计分
    // adaptiveDifficultyLevel.value = ad.difficulty || 1
  }
}).catch(e => console.warn('提交答题记录失败:', e))
```

**`onShowQuiz` 中使用自适应结果**（第418行后）:
```js
currentQuestionType.value = adaptiveQuestionType.value
```

**验证**: 连续答对 3+ 题后，console 中观察 `adaptiveDifficulty.questionType` 变化，实际题型跟随变化。

---

### P1-9: 死亡螺旋保护

**问题**: 答错 → 扣命 + 清连击，但下一题不会变简单。连续答错可能快速 Game Over。

**修改文件 1**: `client/src/views/GameView.vue`

**新增状态**:
```js
const consecutiveWrong = ref(0)
```

**`handleQuizAnswer` 中追踪**（第506行后）:
```js
if (isCorrect) {
  consecutiveWrong.value = 0
} else {
  consecutiveWrong.value++
}
```

**`onShowQuiz` 中添加保护**（设置题型之前）:
```js
// 死亡螺旋保护
if (consecutiveWrong.value >= 3) {
  currentQuestionType.value = 'choice_en2cn'  // 强制最简单题型
  currentDifficulty.value = 1                  // 强制最低难度
} else if (consecutiveWrong.value >= 2) {
  // 降一级难度
  currentDifficulty.value = Math.max(1, (adaptiveQuestionType.value === 'choice_en2cn' ? 1 : currentDifficulty.value - 1))
} else {
  currentQuestionType.value = adaptiveQuestionType.value
}
```

**修改文件 2**: `client/src/game/systems/LevelManager.js`

**新增恩赐生命机制**:
```js
// constructor 中新增
this.graceLifeUsed = false

// initLevel 中重置
this.graceLifeUsed = false

// 新增方法
grantGraceLife() {
  if (!this.graceLifeUsed && this.lives <= 1) {
    this.lives++
    this.graceLifeUsed = true
    eventBus.emit(EVENTS.UPDATE_HUD, { lives: this.lives })
    return true
  }
  return false
}
```

**GameView 中调用**（consecutiveWrong >= 3 时）:
```js
if (consecutiveWrong.value >= 3) {
  const granted = levelManager.grantGraceLife()
  if (granted) {
    // 可选：显示提示 "小智给了你一次机会！"
  }
}
```

**验证**: 连续答错3题 → 下一题变为最简单的选择题 + 如果只剩1命则恢复1命

---

### P1-7: 教程关设计

**问题**: Ch1-Lv1 就有 Boss + 限时 + 有限生命，新手可能首关 Game Over。

**修改文件 1**: `client/src/game/data/levels.json`
在第1章第1关添加 `isTutorial` 标记：
```json
{ "id": 1, "name": "食物天地", "wordsCount": 16, "category": "food",
  "bossType": "roaming", "bossConfig": { "name": "贪吃牛魔", "baseHp": 3, "speed": 30 },
  "isTutorial": true }
```

**修改文件 2**: `client/src/game/scenes/WorldScene.js`

**`init` 中新增**:
```js
this.isTutorial = false
```

**`create` 中检测教程关**（createBoss 之前）:
```js
const chapterData = levelsData.chapters.find(c => c.id === this.chapter)
const levelData = chapterData?.levels.find(l => l.id === this.level)
this.isTutorial = levelData?.isTutorial || false
```

**`createBoss` 开头**:
```js
if (this.isTutorial) return  // 教程关无 Boss
```

**`START_LEVEL` 事件传递 isTutorial**:
```js
eventBus.emit(EVENTS.START_LEVEL, {
  chapter: this.chapter, level: this.level,
  continueGame: this.continueGame, difficulty: this.difficulty,
  isTutorial: this.isTutorial
})
```

**修改文件 3**: `client/src/game/systems/LevelManager.js`

**新增方法**:
```js
setTutorialMode() {
  this.lives = 99
  this.difficultyConfig = { ...this.difficultyConfig, lives: 99, timer: 60000 }
}
```

**修改文件 4**: `client/src/views/GameView.vue`

**`onStartLevel` 中调用**:
```js
async function onStartLevel(data) {
  const { chapter, level, isTutorial } = data
  hudData.chapter = chapter
  hudData.level = level
  hudData.maxLives = gameStore.difficultyConfig.lives
  await loadWordsAndInitLevel(chapter, level)
  if (isTutorial) {
    levelManager.setTutorialMode()
    hudData.maxLives = 99
  }
}
```

**验证**: Ch1-Lv1 无 Boss、99条命、60秒答题时间；Ch1-Lv2 恢复正常

---

### P1-5: 添加音效系统

**问题**: `audio/` 目录为空，代码中无任何音频逻辑。Phaser 3 内置音频支持。

#### 新建文件 1: `client/src/game/systems/AudioManager.js`
```js
class AudioManager {
  constructor() {
    this.scene = null
    this.sounds = {}
    this.muted = localStorage.getItem('wordquest:muted') === 'true'
    this.volume = parseFloat(localStorage.getItem('wordquest:volume') || '0.5')
  }

  init(scene) {
    this.scene = scene
    const keys = ['correct','wrong','boss_appear','boss_defeat','combo','coin','level_complete','click']
    for (const key of keys) {
      if (scene.cache.audio.exists(key)) {
        this.sounds[key] = scene.sound.add(key, { volume: this.volume })
      }
    }
  }

  play(key) {
    if (this.muted || !this.sounds[key]) return
    try { this.sounds[key].play() } catch(e) { /* graceful */ }
  }

  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem('wordquest:muted', String(this.muted))
    return this.muted
  }

  setVolume(v) {
    this.volume = v
    localStorage.setItem('wordquest:volume', String(v))
    Object.values(this.sounds).forEach(s => { s.volume = v })
  }
}

export default new AudioManager()
```

#### 新增音效文件: `client/public/assets/audio/`
需要 8 个短音效 MP3（可从 sfxr.me 生成或 Pixabay 免费下载）：
- `correct.mp3` — 明亮叮咚音
- `wrong.mp3` — 低沉嗡嗡声
- `boss_appear.mp3` — 戏剧性出场音
- `boss_defeat.mp3` — 胜利号角
- `combo.mp3` — 递进音阶
- `coin.mp3` — 金币收集音
- `level_complete.mp3` — 过关音乐
- `click.mp3` — UI 点击音

#### 修改文件 1: `client/src/game/scenes/BootScene.js`
在资源加载区域添加音频加载：
```js
// 音效加载
const sfxKeys = ['correct','wrong','boss_appear','boss_defeat','combo','coin','level_complete','click']
sfxKeys.forEach(key => {
  this.load.audio(key, `/assets/audio/${key}.mp3`)
})
```

#### 修改文件 2: `client/src/game/scenes/WorldScene.js`
```js
import audioManager from '../systems/AudioManager'

// create() 末尾:
audioManager.init(this)

// createBoss() 末尾:
audioManager.play('boss_appear')

// onQuizAnswered() 中:
if (isCorrect) {
  audioManager.play('correct')
  if (data.combo > 0 && data.combo % 5 === 0) audioManager.play('combo')
} else {
  audioManager.play('wrong')
}

// spawnCoinEffect() 中:
audioManager.play('coin')

// onBossQuizResult() Boss 被击败时:
audioManager.play('boss_defeat')

// checkLevelComplete() 中:
audioManager.play('level_complete')
```

#### 修改文件 3: `client/src/views/GameView.vue`
暂停菜单中添加静音按钮：
```vue
<button class="btn pause-btn" @click="toggleMute">
  {{ isMuted ? '🔇 取消静音' : '🔊 静音' }}
</button>
```
```js
import audioManager from '@/game/systems/AudioManager'
const isMuted = ref(audioManager.muted)
function toggleMute() {
  isMuted.value = audioManager.toggleMute()
}
```

**验证**:
- 答对 → 叮咚音效；答错 → 低沉音效
- Boss 出现 → 戏剧性音效；Boss 击败 → 胜利音效
- 5 连击 → combo 音效
- 静音按钮有效且持久化到 localStorage
- 音效文件缺失不报错（graceful fallback）

---

### P1-6: 地图章节差异化

**问题**: 30关使用完全相同的地图（绿色草地 + 40个随机装饰物）。

**修改文件**: `client/src/game/scenes/WorldScene.js`

**新增章节主题常量**（文件顶部）:
```js
const CHAPTER_THEMES = {
  1: { name: '田园', bgColor: '#4a8c28', grassColors: [0x5b8c3e, 0x4a8c28, 0x6b9c4e, 0x5a9a38], decoFrames: [0, 3, 6, 7, 8, 9], decoCount: 40 },
  2: { name: '森林', bgColor: '#2d6b16', grassColors: [0x3a6b1e, 0x2d5016, 0x4a7c2e, 0x3a5a2e], decoFrames: [12, 15, 18, 21, 24, 27], decoCount: 50 },
  3: { name: '集市', bgColor: '#7c6b3e', grassColors: [0x8b7c4a, 0x6b5c3a, 0x9c8c5a, 0x7a6c3e], decoFrames: [0, 3, 9, 12], decoCount: 30 },
  4: { name: '塔楼', bgColor: '#3a4c6e', grassColors: [0x4a5c7e, 0x3a4c6e, 0x5a6c8e, 0x4a5a6e], decoFrames: [6, 7, 15, 18], decoCount: 35 },
  5: { name: '深渊', bgColor: '#2a1a2a', grassColors: [0x3a2a3a, 0x2a1a2a, 0x4a3a4a, 0x3a2a3a], decoFrames: [21, 24, 27], decoCount: 20 },
  6: { name: '终极', bgColor: '#5b5016', grassColors: [0x6b6026, 0x5b5016, 0x7b7036, 0x6a5a26], decoFrames: [0, 3, 6, 9, 12, 15, 18, 21], decoCount: 45 }
}
```

**`createPastoralMap` 中使用主题**（第336行）:
```js
const theme = CHAPTER_THEMES[this.chapter] || CHAPTER_THEMES[1]
this.cameras.main.setBackgroundColor(theme.bgColor)
```

**草地颜色 fallback**（第391行）:
```js
const grassColors = theme.grassColors
```

**`addDecorations` 中使用主题**（第420行）:
```js
addDecorations(mapWidth, mapHeight, tileSize, hasGrassDecor) {
  const theme = CHAPTER_THEMES[this.chapter] || CHAPTER_THEMES[1]
  const decoCount = theme.decoCount
  // ...
  if (hasGrassDecor) {
    const decoFrames = theme.decoFrames
    const frame = decoFrames[Phaser.Math.Between(0, decoFrames.length - 1)]
    // ...
  }
}
```

**验证**: 每个章节视觉上明显不同 — 第5章暗影深渊应该显著偏暗

---

## Phase 3: P2 锦上添花

---

### P2-15: 删除废弃 BattleScene

**问题**: `BattleScene.js` 已注册但从未被调用，且其 `shutdown` 方法会错误移除事件监听。

**操作**:
1. 删除 `client/src/game/scenes/BattleScene.js`
2. 修改 `client/src/game/config.js` — 从 scene 数组中移除 `BattleScene`

---

### P2-13: 错词复习模式

**概要**: 利用已有的 `/learning/top-mistakes` API，创建专门的错词复习功能。

**新建组件**: `client/src/components/ReviewMode.vue`
- 从 API 获取 Top 10-20 错词
- 使用 QuizModal 组件逐词复习（支持多题型）
- 显示正确率提升统计

**修改**: `LevelSelect.vue` 中添加 "错词复习" 入口按钮

---

### P2-10: 无尽模式

**概要**: 30关全通后解锁，随机从全部 400 词中出题，连续答题看能答对多少。

**新建**: 在 `WorldScene.js` 中支持 `endless: true` 模式
- 无 Boss、无星级评定
- 从全词库随机出题
- 难度随答对数逐渐提升
- 记录最高连续答对数

**修改**: `MenuScene.js` 或 `LevelSelect.vue` 中添加无尽模式入口（30关全通后显示）

---

### P2-14: 交互式新手引导

**概要**: 将 `GameIntro.vue` 的纯文字 5 页改为覆盖在游戏画面上的引导步骤。

**改造 GameIntro.vue**:
- 第1步：高亮 WASD 键 + 玩家角色，等待玩家实际移动
- 第2步：箭头指向最近的怪物，等待玩家走过去触发答题
- 第3步：答题完成后提示星级/连击系统
- 后续 Boss 信息在首次遇到 Boss 时再弹出

---

## 全局验证清单

| # | 验证项 | 方法 |
|---|--------|------|
| 1 | 4种新题型均可正常渲染和提交 | 手动切换 questionType 逐一测试 |
| 2 | 拼写题输入/提交/超时/正确拼写展示 | 输入正确/错误单词各测一次 |
| 3 | Boss 多轮答题（HP=3需答3题） | Ch1-Lv1 Boss 战测试 |
| 4 | 3秒内答对得分 +50 | 观察分数飘字 |
| 5 | login_3 成就可触发 | MongoDB 设置 loginStreak=3 后验证 |
| 6 | npc_friend 成就可触发 | 对话 10 次验证 |
| 7 | 自适应难度生效（3连对升级） | 连续答对观察题型变化 |
| 8 | 死亡螺旋保护（3连错降级） | 故意连错观察题型降级 |
| 9 | 教程关无 Boss + 99命 | Ch1-Lv1 进入验证 |
| 10 | 音效播放且静音有效 | 答对/答错/Boss/连击各听一次 |
| 11 | 6章地图视觉不同 | 每章进入第1关对比 |
| 12 | BattleScene 删除后无报错 | 全流程跑一遍 |
| 13 | 已有功能无回退 | 完整游玩 Ch1 全5关 |

## 预估总工时

| 优先级 | 项目数 | 时间 |
|--------|--------|------|
| P0 | 4项 | ~5小时 |
| P0+P1 | 9项 | ~13小时 |
| 全部 | 12项 | ~19小时 |
