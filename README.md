# 🌿 词汇大冒险 (Word Quest)

> AI 辅助游戏化英语词汇学习系统 — 毕业设计项目

<p align="center">
  <strong>Phaser 3 像素风游戏 + Vue 3 前端 + Node.js 后端 + 通义千问 AI 学伴</strong>
</p>

## 本轮更新说明（2026-06-09）

### 最终盲审修复（2 个 bug）

| # | Bug | 严重度 | 修复 |
|---|-----|--------|------|
| 1 | `require()` 在 ESM 模块中不可用，排行榜 API 启动崩溃 | 🔴 致命 | `import User from '../models/User.js'` 替代 `require()` |
| 2 | `myUserId` 未初始化，排行榜无法高亮当前用户 | 🟡 中等 | 从 `useUserStore()` 获取当前用户 ID |
| 3 | 全时排行榜缺少用户去重，理论可重复 | 🟢 轻微 | 添加 `Set` 去重逻辑 |

| 改动 | 文件 | 说明 |
|------|------|------|
| 排行榜 API | `server/src/routes/leaderboard.js` | 周榜(QuizRecord聚合) + 全时榜(GameProgress排名) |
| 防刷分中间件 | `server/src/middleware/antiCheat.js` | 速度/分数/连续全对检测，服务端独立计分 |
| 排行榜 UI | `client/src/components/LeaderboardView.vue` | 周榜/总榜 Tab 切换，金/银/铜牌，当前排名高亮 |
| 游戏集成 | `server/src/app.js` + `GameView.vue` | 路由注册，排行榜浮窗替换为 LeaderboardView |

### 第五轮更新（Cycle 5）— CET-4 词库选择 + 进度分化

| 改动 | 文件 | 说明 |
|------|------|------|
| 词库选择器 | `client/src/components/WordbookSelect.vue` | 可视化词库列表（CET-4/CET-6/考研），显示词数+章节数，一键切换 |
| 仪表盘集成 | `client/src/views/DashboardView.vue` | 仪表盘顶栏显示当前词库 📚，点击可切换词库 |
| 游戏集成 | `client/src/views/GameView.vue` | 词库切换后自动刷新关卡数据，支持 uiState 管理 |

### 第四轮更新（Cycle 4）— AI 教练事实校验 + LLM 优化

| 改动 | 文件 | 说明 |
|------|------|------|
| 词源校验器 | `llm-service/services/etymology_validator.py` | 120+ 已知词根白名单，验证 AI 词源解释，标记可疑声明 |
| Prompt 诚实规则 | `llm-service/services/prompt_manager.py` | 新增规则 7：不确定的词根必须诚实说明，禁止编造 |
| 对话缓存 | `server/src/services/chatCacheService.js` | LRU 缓存(500条/24h)，同词同语境复用，降低 API 成本 |
| 离线降级 | `server/src/services/chatFallbackService.js` | 6 种场景预置回复，LLM 不可用时自动切换 |
| 聊天限流 | `server/src/routes/chat.js` | 每用户 10次/分钟，超限返回 429 + 友好提示 |
| 降级集成 | `server/src/routes/chat.js` | 超时/连接失败自动降级到预置回复，用户无感知 |

### 盲审修复（5 个 bug）

| # | Bug | 严重度 | 修复 |
|---|-----|--------|------|
| 1 | `gotoSceneSafe` 未定义，今日冒险启动崩溃 | 🔴 致命 | 新增 `gotoSceneSafe()` 函数（安全停止+启动场景） |
| 2 | `_isAdventure` 未在 `initLevel` 重置 | 🟡 中 | 在 `initLevel` 中重置为 false |
| 3 | 网络错误时误提示"全部已复习" | 🟡 中 | 检查 `res.data.success`，失败时提示"网络开小差" |
| 4 | MenuScene badge 更新可能操作已销毁对象 | 🟡 中 | 增加 `active && scene.isActive()` 守卫 |
| 5 | 学习面板与奖励文字/按钮重叠 | 🟡 中 | 奖励位置和按钮 Y 动态跟随 mastery 面板 |

### 第三轮更新（Cycle 3）— 今日冒险（SM-2 到期复习模式）

| 改动 | 文件 | 说明 |
|------|------|------|
| 今日冒险 API | `server/src/routes/dailyAdventure.js` | 新增 `/api/daily-adventure/queue`（合并 SM-2 到期 + QuizRecord 聚合）和 `/count` 端点 |
| 主菜单入口 | `MenuScene.js` | 新增 📋 今日冒险按钮，动态显示待复习单词 badge 数字 |
| 冒险启动流程 | `GameView.vue` + `client/src/api/dailyAdventure.js` | 点击按钮获取复习队列→启动 WorldScene 冒险模式 |
| 路由注册 | `server/src/app.js` | 注册 dailyAdventure 路由 |

### 第二轮更新（Cycle 2 收尾）— 学习效果双轨展示 + 救援动画 + 单测补全

| 改动 | 文件 | 说明 |
|------|------|------|
| 学习掌握度面板 | `ResultScene.js` + `LevelManager.js` | 结算页新增 🧠 学习掌握度迷你面板，展示主动回忆/再认选择/掌握质量/系统降级四项指标，区分”游戏分”与”学习分” |
| Grace Life 全屏闪白 | `GameView.vue` | 恩赐生命触发时增加径向渐变全屏闪白动画（0.12s 进入/0.55s 淡出），让玩家清晰感知被救援 |
| 学习度量追踪 | `LevelManager.js` + `useQuizFlow.js` | 新增 `trackLearningQuality()` 方法，每题追踪 recall/recognition/downgraded/quality |
| T2/T3/T4 单测 | `tests/unit/cycle2.quality.test.mjs` | 8 个测试用例覆盖 speed_demon 非选择题限定、自适应记账分离、学习度量字段 |

### 第一轮更新 — 关卡切换稳定性 + 自适应学习数据闭环

| 问题 | 根因 | 解决方案 |
| --- | --- | --- |
| 第二关进入准备页后点击 Skip 白屏 | 教程提示条在准备页提前显示，遮挡并干扰 Phaser 场景切换 | 将教程提示延后到真正进入 WorldScene 后显示，准备页保持干净可点击 |
| 退出一次关卡后再进入下一关白屏 | WorldScene 关闭时重复清理 Phaser 物理组，部分 group 已被 Phaser 内部释放，再调用 clear 会抛出异常 | 为 WorldScene 增加安全清理方法，半销毁状态下不再抛错，并统一处理 active/sleeping 场景停止 |
| 死亡螺旋救援反馈不清晰 | 系统保留生命但玩家缺少明确反馈，容易误判为生命异常 | 新增”小智救援生效”顶部提示，说明系统保留 1 点生命并将该词纳入重点复习 |
| 降级题型影响真实能力评估 | 救援场景下的降级题与正常推荐题混在一起，容易污染自适应难度判断 | 记录推荐题型、实际题型、是否降级、回忆模式，并在自适应算法中优先使用非降级样本 |

### 已完成验证

- 前端生产构建：`npm run build` 通过（718 模块，8.82s）。
- 退出关卡后进入下一关自动回归：进入一关 -> 暂停返回菜单 -> 进入第二关 -> Skip -> 正常进入地图，无 pageerror。
- 第二关 Skip 自动回归：准备页无教程遮挡，点击 Skip 后正常进入第 1 章第 2 关。
- `node --check` 语法检查：全部修改文件通过。
- `git diff --check` 通过。

---

## 📖 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [技术架构](#-技术架构)
- [快速开始](#-快速开始)
  - [Docker 一键部署（推荐）](#方式一docker-一键部署推荐)
  - [本地开发部署](#方式二本地开发部署)
- [配置说明](#-配置说明)
- [项目结构](#-项目结构)
- [API 接口文档](#-api-接口文档)
- [数据库设计](#-数据库设计)
- [游戏系统设计](#-游戏系统设计)
- [AI 学伴系统](#-ai-学伴系统)
- [安全机制](#-安全机制)
- [常见问题](#-常见问题)

---

## 🌾 项目简介

**词汇大冒险**是一款面向 CET-4 英语词汇学习的 2D 像素风 RPG 教育游戏。玩家在田园风格的游戏世界中探索、与怪物战斗（答题）、收集金币、解锁成就，同时由 AI 学伴"小智"提供个性化辅导。

### 核心玩法
1. **探索** — 在田园像素风地图中自由移动
2. **战斗** — 接触怪物触发英语词汇答题
3. **学习** — 答错后 AI 学伴提供记忆技巧和讲解
4. **成长** — 积分、连击、星级、成就系统激励持续学习

### 适用对象
- 大学英语 CET-4 备考学生
- 对游戏化学习感兴趣的英语初学者

---

## ✨ 功能特性

### 游戏系统
| 功能 | 说明 |
|------|------|
| 🎮 像素风 RPG | Sprout Lands 田园素材，角色行走动画，完整树木与花草装饰 |
| ⚔️ 答题战斗 | 多题型（选择/拼写/翻译），30 秒倒计时，连击加分 |
| 👹 Boss 战 | 3 种 Boss 类型（巡逻/炮台/冲锋），答题攻击 Boss |
| ♾️ 无尽模式 | 无限答题挑战，难度随连续答对数动态提升（5 级） |
| 📝 错词复习 | 专项复习答错词汇，针对性巩固薄弱环节 |
| 🔄 错词重测 | 答错的怪物 2 秒后恢复，强制重复练习 |
| ⭐ 三星评级 | 基于正确率、速度、生命值的星级评定 |
| 🎯 难度选择 | 简单/普通/困难三档，影响生命值、时间和分数倍率 |
| 👤 角色系统 | 8 种角色外观选择，实时预览 |
| 🏆 成就系统 | 16 个成就覆盖连击、词汇量、速度等维度 |
| ⏸️ 暂停菜单 | 暂停/继续/返回菜单/退出登录 |
| 📊 学习报告 | 每日统计、章节分析、错词排行、学习热力图 |
| 🏅 排行榜 | 全服总分/经验排名 Top 50 |
| 🎁 每日奖励 | 连续登录递增奖励（基础 10 + 连续天数 × 5 经验） |

### AI 学伴"小智"
| 功能 | 说明 |
|------|------|
| 🤖 智能对话 | 接入通义千问，上下文感知的个性化回复 |
| 💡 记忆技巧 | 词根词缀分析、联想记忆法、语境记忆 |
| 📖 例句生成 | 根据当前学习单词生成例句 |
| 🛡️ 内容安全 | 输入/输出双重过滤，仅允许英语学习话题 |
| 🔄 流式输出 | SSE 实时流式回复，打字机效果 |

### 技术亮点
| 特性 | 说明 |
|------|------|
| 🐳 Docker 一键部署 | 全容器化，任何环境零配置启动 |
| 🔒 安全防护 | Helmet + 限流 + CORS + 注入防护 + 输入校验 |
| 📱 模块化架构 | Phaser ↔ Vue 事件总线解耦，场景切换防幽灵点击 |
| 🎨 田园像素风 | Sprout Lands 专业像素素材包，多帧拼接树木 |
| 🛡️ 容错设计 | API 独立容错、加载进度反馈、优雅降级（内存数据库） |
| 📖 例句系统 | 答题后展示英文例句 + 中文翻译，强化语境记忆 |

---

## 🏗 技术架构

```
┌─────────────────────────────────────────────┐
│                   Client                     │
│  Vue 3 + Phaser 3 + Pinia + Vue Router      │
│  Sprout Lands 像素素材 + SCSS 田园主题        │
│                   :3000                      │
└──────────────────┬──────────────────────────┘
                   │ HTTP / SSE
┌──────────────────▼──────────────────────────┐
│                  Server                      │
│  Express.js + Mongoose + JWT                 │
│  Helmet + Rate Limit + CORS                  │
│                  :4000                       │
└────────┬─────────────────────┬──────────────┘
         │                     │
┌────────▼────────┐  ┌────────▼────────┐
│    MongoDB      │  │   LLM Service   │
│   mongo:7.0     │  │ FastAPI + 通义千问│
│    :27017       │  │    :8000        │
└─────────────────┘  └─────────────────┘
```

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| **前端** | Vue 3 + Phaser 3 + Pinia | SPA + 2D 游戏引擎 + 状态管理 |
| **后端** | Express.js + Mongoose | RESTful API + MongoDB ODM |
| **AI 服务** | FastAPI + 通义千问 | Python 微服务 + LLM 代理 |
| **数据库** | MongoDB 7.0 | 用户/进度/词库/学习记录 |
| **部署** | Docker Compose | 4 服务编排 + 自动初始化 |

---

## 🚀 快速开始

### 方式一：Docker 一键部署（推荐）

**前提条件**: 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)

```bash
# 1. 克隆项目
git clone <仓库地址>
cd ai-gamified-learning

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入通义千问 API Key（可选，不填则使用模拟回复）

# 3. 一键启动
# Windows:
start.bat

# Linux / Mac:
chmod +x start.sh && ./start.sh
```

启动后访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 🎮 游戏 | http://localhost:3000 | 主入口 |
| 🔌 API | http://localhost:4000/api/health | 健康检查 |
| 🤖 LLM | http://localhost:8000/health | AI 服务状态 |

**测试账号**: `test` / `123456`

**常用命令**:
```bash
docker-compose down          # 停止所有服务
docker-compose logs -f       # 查看实时日志
docker-compose up -d --build # 重新构建并启动
docker-compose ps            # 查看服务状态
```

---

### 方式二：本地开发部署（无需 Docker）

**前提条件**:
- Node.js 18+
- MongoDB 7.0+（可选，未安装则自动使用内存数据库）
- Python 3.11+（可选，AI 功能需要）

#### 一键启动

```bash
# Windows:
start-local.bat

# Linux / Mac:
chmod +x start-local.sh && ./start-local.sh
```

脚本会自动安装依赖、启动后端（含自动数据初始化）和前端。

> **注意**: 如果未安装 MongoDB，系统会自动启动内存数据库并导入测试数据。内存数据库中的数据在服务器重启后会丢失，适合开发和演示使用。

#### 手动分步启动

```bash
# 1. 启动后端（自动初始化词库 + 测试用户）
cd server
npm install
npm run dev                # 启动开发服务器 (端口 4000)

# 2. 启动前端（新终端）
cd client
npm install
npm run dev                # 启动开发服务器 (端口 3000)

# 3. 启动 AI 服务（可选，新终端）
cd llm-service
pip install -r requirements.txt
python main.py             # 启动 FastAPI (端口 8000)
```

访问 http://localhost:3000 开始游戏。

---

## ⚙ 配置说明

### 环境变量（`.env`）

```bash
# ===== 必填 =====
JWT_SECRET=你的强随机密钥         # JWT 签名密钥（生产环境务必修改）

# ===== 可选（AI 功能）=====
QWEN_API_KEY=你的API_Key          # 通义千问 DashScope API Key
# 获取地址: https://dashscope.console.aliyun.com/apiKey
# 可选: QWEN_MODEL=qwen-plus（默认）
# 不填则使用本地模拟回复，游戏其他功能不受影响

# ===== 高级配置 =====
PORT=4000                        # 后端端口
MONGODB_URI=mongodb://localhost:27017/word-quest
JWT_EXPIRES_IN=7d                # Token 有效期
LLM_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=production
```

---

## 📁 项目结构

```
ai-gamified-learning/
├── docker-compose.yml          # Docker 编排配置
├── .env.example                # 环境变量模板
├── start.bat / start.sh        # Docker 一键部署脚本
├── start-local.bat / .sh       # 本地开发启动脚本（无需 Docker）
│
├── client/                     # 前端 (Vue 3 + Phaser 3)
│   ├── public/assets/          # 游戏素材
│   │   ├── sprout-lands/       # 角色/地形/装饰素材
│   │   └── sprout-lands-ui/    # UI 素材包
│   ├── src/
│   │   ├── api/                # API 调用层
│   │   ├── components/         # Vue 组件
│   │   │   ├── QuizModal.vue       # 答题弹窗（多题型+例句展示）
│   │   │   ├── BossQuizModal.vue   # Boss 战答题弹窗
│   │   │   ├── EndlessMode.vue     # 无尽模式（进度条+难度递增）
│   │   │   ├── ReviewMode.vue      # 错词复习模式
│   │   │   ├── ChatPanel.vue       # AI 学伴对话面板
│   │   │   ├── LevelSelect.vue     # 关卡选择（章节/难度/解锁状态）
│   │   │   ├── CharacterSelect.vue # 角色选择
│   │   │   ├── ScoreBoard.vue      # 排行榜
│   │   │   └── AchievementPopup.vue # 成就弹窗
│   │   ├── game/               # Phaser 游戏层
│   │   │   ├── scenes/         # Boot/Menu/World/Result 场景
│   │   │   ├── entities/       # Boss（巡逻/炮台/冲锋）
│   │   │   ├── systems/        # EventBus/LevelManager/ScoreSystem/AudioManager
│   │   │   ├── config/         # gameConstants.js（章节主题/难度/计分）
│   │   │   └── data/           # levels.json（6章30关配置）
│   │   ├── views/              # HomeView/GameView/Dashboard/Profile
│   │   ├── stores/             # Pinia 状态管理
│   │   └── styles/             # 全局 SCSS 田园主题
│   └── Dockerfile              # 多阶段构建 (Vite → Nginx)
│
├── server/                     # 后端 (Express.js)
│   ├── src/
│   │   ├── routes/             # auth/game/vocab/learning/chat
│   │   ├── models/             # User/GameProgress/VocabularyBank/QuizRecord/LearningLog
│   │   ├── middleware/         # JWT 认证 + 错误处理
│   │   ├── services/           # 业务逻辑层
│   │   └── seed.js             # 数据库初始化
│   └── Dockerfile              # Node.js (非 root 运行)
│
└── llm-service/                # AI 微服务 (Python FastAPI)
    ├── services/
    │   ├── ernie_client.py     # 通义千问 API 客户端 (DashScope)
    │   ├── prompt_manager.py   # NPC 对话 Prompt 管理
    │   └── safety_filter.py    # 内容安全过滤
    └── Dockerfile
```

---

## 📡 API 接口文档

### 认证 (`/api/auth`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/register` | 否 | 注册（username/password/nickname） |
| POST | `/login` | 否 | 登录，限 10 次/15min |
| GET | `/me` | JWT | 获取当前用户信息 |

### 游戏 (`/api/game`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/progress` | JWT | 获取游戏进度 |
| POST | `/progress` | JWT | 保存关卡成绩（服务端积分校验） |
| GET | `/levels-status` | JWT | 获取关卡地图（解锁/星级/分数） |
| GET | `/leaderboard?type=total` | 否 | 排行榜 (top 50) |
| GET | `/achievements` | JWT | 获取已解锁成就 |
| POST | `/daily-reward` | JWT | 领取每日登录奖励 |
| PUT | `/character` | JWT | 保存角色外观选择 |

### 词库 (`/api/vocab`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/chapter/:chapter` | JWT | 获取整章词汇 |
| GET | `/chapter/:chapter/level/:level` | JWT | 获取关卡词汇 |
| GET | `/quiz/:wordId` | JWT | 获取题目 + 干扰项 |
| GET | `/search?q=keyword` | JWT | 搜索词汇 |

### 学习 (`/api/learning`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/quiz-record` | JWT | 提交答题记录 |
| GET | `/stats` | JWT | 总体统计 |
| GET | `/daily-stats?days=30` | JWT | 每日统计 |
| GET | `/chapter-stats` | JWT | 章节正确率 |
| GET | `/top-mistakes?limit=10` | JWT | 错词排行 |
| GET | `/heatmap?year=2026` | JWT | 学习热力图 |

### AI 对话 (`/api/chat`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/message` | JWT | 非流式对话 (30s 超时) |
| POST | `/stream` | JWT | SSE 流式对话 (60s 超时) |

---

## 🗄 数据库设计

```
User (用户)
 ├── 1:1 → GameProgress (游戏进度、成就、星级)
 ├── 1:N → QuizRecord (答题记录、正确率、用时)
 └── 1:N → LearningLog (学习日志、登录、事件)

VocabularyBank (词库: 6章×5关, 400词)
 └── word/phonetic/meaning/example/exampleTranslation/difficulty/chapter/level
```

---

## 🎮 游戏系统设计

### 计分公式

```
score = 100 × difficulty + min(combo × 10, 50) + timeBonus
timeBonus: <3秒 → +50 | <5秒 → +30 | <10秒 → +15 | 其他 → 0
最终得分 = score × 难度倍率（简单 0.8 / 普通 1.0 / 困难 1.5）
```

### 难度系统

| 难度 | 生命 | 答题时限 | 分数倍率 | 怪物数修正 |
|------|------|---------|---------|-----------|
| 🌱 简单 | 4 命 | 35 秒 | ×0.8 | -2 |
| ⚔️ 普通 | 3 命 | 30 秒 | ×1.0 | +0 |
| 🔥 困难 | 2 命 | 20 秒 | ×1.5 | +3 |

### 星级评定

| 星级 | 条件 |
|------|------|
| ⭐⭐⭐ | 正确率 ≥ 95% 且 平均用时 < 8s 且 零失误 |
| ⭐⭐ | 正确率 ≥ 80% 且 剩余生命 ≥ 2 |
| ⭐ | 正确率 ≥ 50% |

### 成就系统（16 个）

涵盖：首次通关、完美通关、连击成就、词汇量里程碑、速度挑战、章节完成、登录坚持、NPC 互动等。

---

## 🤖 AI 学伴系统

### 小智的性格
> 活泼、友善、耐心的英语学习伙伴。中文交流，回复简洁（100 字内），不直接给答案而是引导思考。

### 触发场景

| 场景 | 触发 | 响应策略 |
|------|------|---------|
| 答错辅导 | 答错后自动弹出 | 共情 → 记忆技巧 → 例句 → 鼓励 |
| 主动求助 | 点击 🤖 按钮 | 解释 → 词根分析 → 记忆法 |
| 连续答错 ≥3 | 自动识别 | 安慰 → 学习建议 → 趣味知识 |
| 连续答对 ≥5 | 自动识别 | 庆祝 → 挑战更难词 |

### 安全过滤
- 输入过滤: 拦截政治/暴力/成人等敏感话题
- 输出过滤: 限制回复 300 字，过滤不当内容
- 话题限制: 仅允许英语学习相关对话

---

## 🔒 安全机制

| 层级 | 机制 | 说明 |
|------|------|------|
| 认证 | JWT + bcrypt | 7 天有效期，10 轮加盐哈希 |
| 限流 | express-rate-limit | 全局 100/min，认证/聊天 10/min |
| 防护 | Helmet.js | XSS/点击劫持/MIME 嗅探防护 |
| CORS | 白名单机制 | 仅允许配置的前端域名 |
| 注入防护 | 正则转义 + 字段白名单 | 防 NoSQL 注入和 Mass Assignment |
| 输入校验 | 服务端全量校验 | 类型/范围/长度检查 |
| 容器安全 | 非 root 运行 | Docker USER node |
| 密钥管理 | .gitignore + .dockerignore | .env 不入库不入镜像 |

---

## ❓ 常见问题

### 小智只会机械回复？
未配置通义千问 API Key，运行在 Mock 模式。编辑 `.env` 填入 `QWEN_API_KEY`，然后 `docker-compose restart llm-service`。

### Docker 启动后访问不了？
```bash
docker-compose ps       # 查看服务状态
docker-compose logs -f  # 查看错误日志
```
常见原因: MongoDB 未就绪（等 10 秒）、端口被占用、镜像构建失败。

### 其他设备无法访问？
```bash
# Windows 防火墙放行
netsh advfirewall firewall add rule name="WordQuest" dir=in action=allow protocol=TCP localport=3000
```
然后用 `http://你的IP:3000` 访问（需同一局域网）。

### 如何重置数据库？
```bash
docker-compose down
docker volume rm ai-gamified-learning_mongo-data
docker-compose up -d
```

### 如何添加新词汇？
编辑 `server/src/data/vocabulary.json`，然后 `npm run seed` 或重启 Docker。

---

## 📄 许可证

本项目为毕业设计作品。游戏素材来自 [Sprout Lands](https://cupnooble.itch.io/sprout-lands-asset-pack)（免费版），仅限学术用途。

---

<p align="center">
  <em>🌾 穿越词汇田园，击败遗忘怪物，AI学伴陪你闯关 🌾</em>
</p>
