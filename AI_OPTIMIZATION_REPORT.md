# Word Quest AI 模块优化报告

生成时间：2026-05-05
项目路径：`d:\CLAW\sxh-game\ai-gamified-learning`

## 一、优化目标

本次优化围绕“AI 辅助游戏化英语词汇学习系统”中 AI 工作量不足的问题展开，目标是把原有“游戏化系统 + 大模型接口调用”的结构升级为更完整的 AI 学习闭环：

```text
语义干扰项生成 -> 编辑距离模糊评分 -> 能力值自适应难度 -> LLM 个性化辅导
```

优化坚持以下原则：

1. 不引入大型外部模型或重型依赖，避免部署不稳定。
2. 尽量复用现有 400 词词库中的 `category`、`difficulty`、`synonyms`、`antonyms`、`rootAnalysis`、`memoryTip` 等字段。
3. 服务端保持最终判分权，避免客户端伪造正确性与得分。
4. 前后端算法逻辑保持一致，降低交互显示与后端记录不一致的风险。
5. 所有新增逻辑保留 fallback，避免数据不足时接口失败。

---

## 二、核心改动概览

### 1. 语义干扰项生成

新增文件：

- `server/src/services/distractorService.js`

修改文件：

- `server/src/routes/vocabulary.js`
- `client/src/api/vocabulary.js`
- `client/src/views/GameView.vue`
- `client/src/components/BossQuizModal.vue`

原逻辑：

```text
MongoDB $sample 随机抽取 3 个同章节词汇作为干扰项
```

新逻辑：

```text
基于词汇字段构建轻量语义特征，综合计算候选词相似度分数，选择语义接近但不等同的 3 个干扰项。
```

评分特征包括：

| 特征 | 作用 |
|---|---|
| category 是否一致 | 保证干扰项属于相近语义主题 |
| difficulty 接近度 | 避免选项难度差异过大 |
| chapter / level 接近度 | 保持学习阶段一致 |
| 中文释义字符重合度 | 提升英译中题目的语义迷惑性 |
| rootAnalysis / memoryTip token 重合 | 利用词根词缀与记忆提示增强语义相关性 |
| 英文词形前缀/后缀/长度相似度 | 覆盖 affect/effect 等易混词形 |
| synonyms / antonyms 关系过滤 | 避免把可接受同义词作为唯一错误选项 |

接口变化：

```http
GET /api/vocab/quiz/:wordId?questionType=choice_en2cn
```

响应新增：

```json
{
  "strategy": "semantic_feature_similarity",
  "distractors": [
    {
      "id": "...",
      "word": "...",
      "meaning": "...",
      "semanticScore": 0.71,
      "semanticReasons": {
        "sameCategory": true,
        "sameChapter": true,
        "difficultyScore": 1
      }
    }
  ]
}
```

论文可写点：

> 系统采用基于词汇语义特征融合的智能干扰项生成算法，从词汇类别、难度、章节、词根词缀和词形相似度等多个维度计算候选词相似度，提升选择题选项的迷惑性和学习价值。

---

### 2. 编辑距离模糊评分

新增文件：

- `server/src/services/fuzzyScoringService.js`

修改文件：

- `server/src/services/answerVerificationService.js`
- `server/src/services/scoringService.js`
- `server/src/models/QuizRecord.js`
- `server/src/routes/learning.js`
- `client/src/utils/helpers.js`
- `client/src/components/QuizModal.vue`
- `client/src/components/BossQuizModal.vue`
- `client/src/views/GameView.vue`

原逻辑：

```text
拼写题只做标准化后的字符串完全相等比较。
```

新逻辑：

```text
拼写/翻译类题型使用 Levenshtein 编辑距离，区分 exact / near / wrong 三档答案质量。
```

判定规则：

| 单词长度 | near 条件 |
|---|---|
| 1-4 个字母 | 不允许模糊，必须完全正确 |
| 5-7 个字母 | 编辑距离不超过 1 |
| 8 个字母以上 | 编辑距离不超过 2，且相似度不低于 0.78 |

评分规则：

| answerQuality | 是否接受 | 分数比例 |
|---|---:|---:|
| exact | 是 | 100% |
| near | 是 | 编辑距离 1 给 75%；编辑距离 2 给 60% |
| wrong | 否 | 0% |

新增答题记录字段：

```js
answerQuality: 'exact' | 'near' | 'wrong'
editDistance: Number | null
similarity: Number
scoreRatio: Number
fuzzyFeedback: String
```

示例：

```text
标准答案：environment
学生答案：enviroment
编辑距离：1
相似度：0.909
判定：near
计分：75%
```

论文可写点：

> 系统引入 Levenshtein 编辑距离算法，对学生拼写答案进行细粒度评价，避免传统二值判分无法区分轻微拼写错误和完全错误的问题。

---

### 3. 能力值自适应难度模型

修改文件：

- `server/src/services/adaptiveEngine.js`

原逻辑：

```text
连续答对 3 次升级；连续答错 2 次降级；正确率高且速度快时额外升级。
```

新逻辑：

```text
基于最近 20 条答题记录构建滑动窗口，计算 learner ability score，再映射到 5 级题型。
```

能力值特征：

| 特征 | 权重 |
|---|---:|
| 近期正确率 | 0.42 |
| 答案质量均值 | 0.28 |
| 响应速度得分 | 0.18 |
| 连续答题状态 | 0.12 |

题型映射：

| abilityScore | 难度 | 题型 |
|---:|---:|---|
| < 0.34 | 1 | 英译中选择题 |
| 0.34 - 0.52 | 2 | 中译英选择题 |
| 0.52 - 0.68 | 3 | 首字母提示拼写 |
| 0.68 - 0.84 | 4 | 完整拼写 |
| >= 0.84 | 5 | 翻译题 |

额外保护：

- 单次最多升降 1 级，避免难度跳变。
- 连续答错 2 次直接降 1 级，避免挫败。
- 样本少于 10 条时引入置信度折减，降低冷启动误判。

论文可写点：

> 系统基于学习者近期正确率、答题质量、响应速度和连续答题状态构建能力值模型，实现从选择题到拼写题、翻译题的动态题型调整。

---

### 4. LLM 个性化辅导增强

修改文件：

- `client/src/components/ChatPanel.vue`
- `client/src/views/GameView.vue`
- `llm-service/services/prompt_manager.py`
- `llm-service/services/ernie_client.py`

原逻辑：

```text
答错后打开 ChatPanel，但初始提示主要是固定文案；LLM 只拿到有限上下文。
```

新逻辑：

```text
答错后前端自动触发一次“错因分析”请求，并把玩家答案、标准答案、答案质量、编辑距离、相似度、词根词缀、记忆技巧、例句、同义词、反义词等上下文传入 LLM。
```

新增上下文字段：

```js
correctAnswer
playerAnswer
answerQuality
editDistance
similarity
fuzzyFeedback
wordKnowledge: {
  rootAnalysis,
  memoryTip,
  example,
  exampleTranslation,
  synonyms,
  antonyms,
  category
}
```

LLM Prompt 增强后要求模型输出：

1. 具体错因。
2. 拼写错误位置或混淆点。
3. 可执行的记忆方法。
4. 简短鼓励。

论文可写点：

> 系统将学生答题行为和词汇知识库信息作为上下文注入大语言模型，使 AI 学伴能够生成基于错误类型的个性化反馈。

---

### 5. 构建稳定性修复

修改文件：

- `client/index.html`
- `client/src/styles/global.scss`

问题：

前端构建时，Vite 对 `index.html` 中内联 `<style>` 处理失败，报错：

```text
[vite:html-inline-proxy] No matching HTML proxy module found
```

修复：

将 `@font-face` 和 canvas 像素渲染样式从 `index.html` 内联样式迁移到 `src/styles/global.scss`。

结果：

```text
npm --prefix client run build 通过
```

---

## 三、修改文件清单

核心新增：

- `server/src/services/distractorService.js`
- `server/src/services/fuzzyScoringService.js`

核心修改：

- `server/src/routes/vocabulary.js`
- `server/src/routes/learning.js`
- `server/src/models/QuizRecord.js`
- `server/src/services/adaptiveEngine.js`
- `server/src/services/answerVerificationService.js`
- `server/src/services/scoringService.js`
- `client/src/api/vocabulary.js`
- `client/src/utils/helpers.js`
- `client/src/components/QuizModal.vue`
- `client/src/components/BossQuizModal.vue`
- `client/src/components/ChatPanel.vue`
- `client/src/views/GameView.vue`
- `llm-service/services/prompt_manager.py`
- `llm-service/services/ernie_client.py`
- `client/index.html`
- `client/src/styles/global.scss`

---

## 四、验证结果

### 1. 前端构建

命令：

```bash
npm --prefix "d:/CLAW/sxh-game/ai-gamified-learning/client" run build
```

结果：

```text
通过
```

说明：

- Vite 构建成功。
- Vue 单文件组件编译成功。
- 仍存在 Sass legacy JS API deprecation warning 和 chunk size warning，属于依赖与打包体积警告，不是本次改动导致的功能性错误。

### 2. 后端 JS 语法检查

命令：

```bash
node --check server/src/**/*.js
```

结果：

```text
checked 50 js files
```

说明：

- 服务端和前端 JS 源文件语法检查均通过。

### 3. Python AI 服务语法检查

命令：

```bash
python -m py_compile llm-service/services/ernie_client.py llm-service/services/prompt_manager.py
```

结果：

```text
通过
```

### 4. 模糊评分逻辑抽样验证

测试样例：

| 输入 | 标准答案 | 判定 |
|---|---|---|
| environment | environment | exact |
| enviroment | environment | near |
| cat | cut | wrong |
| 空 | apple | wrong |

验证结果符合预期。

---

## 五、答辩展示建议

### 展示一：随机干扰项 vs 语义干扰项

可以展示同一个单词在优化前后的选项差异：

```text
优化前：随机抽取，可能出现语义距离很远的选项。
优化后：优先选择同类别、同难度、词义或词形接近的选项。
```

答辩话术：

> 系统不再随机生成选项，而是根据词汇语义特征计算候选词相似度，使干扰项更具教学价值和区分度。

### 展示二：拼写模糊评分

示例：

```text
标准答案：environment
学生输入：enviroment
系统判定：接近正确
编辑距离：1
计分比例：75%
```

答辩话术：

> 传统判分只能给出对或错，而本系统能够识别轻微拼写错误，给出更细粒度的反馈。

### 展示三：自适应难度变化

可以连续答对或答错几题，展示题型变化：

```text
选择题 -> 首字母提示拼写 -> 完整拼写 -> 翻译题
```

答辩话术：

> 系统根据学习者近期表现动态调整题型，避免题目过难或过易，提高学习路径的个性化程度。

### 展示四：LLM 错因分析

答错后展示 AI 学伴自动分析：

```text
玩家答案、标准答案、编辑距离、词根词缀、记忆技巧会一起注入到 LLM 上下文中。
```

答辩话术：

> 大语言模型不是孤立聊天，而是结合学生答题行为和词汇知识库进行个性化辅导。

---

## 六、风险与边界说明

1. 本次没有引入大型预训练词向量模型，主要考虑部署稳定性和毕设可控性。
2. 当前语义干扰项属于“轻量语义特征融合算法”，不是深度神经网络模型，论文表述应避免夸大为“训练了词向量模型”。
3. `near` 答案被视为可接受答案，但按比例计分；这符合学习系统鼓励纠错的目标。
4. 短词不允许模糊评分，避免 `cat/cut` 这类一个字母差异导致误判。
5. 前端构建存在 chunk size warning，主要来自 Phaser 和 ECharts 体积，后续可通过动态导入继续优化。

---

## 七、结论

本次优化后，项目的 AI 含量从原来的“大模型 API 辅导 + 规则自适应”提升为四层结构：

1. 表示与语义层：基于词汇特征融合的语义干扰项生成。
2. 算法评价层：基于 Levenshtein 编辑距离的模糊评分。
3. 学习路径层：基于能力值的自适应难度调整。
4. 应用生成层：基于 LLM 的上下文个性化辅导。

这条链路能够较好支撑论文与答辩中的“AI 辅助学习”主题，也能明确体现算法设计、工程实现和教育应用价值。
