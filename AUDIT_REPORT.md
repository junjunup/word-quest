# 🔍 词汇大冒险 (Word Quest) — 全面审查报告

**审查日期**: 2026-03-31
**审查范围**: 代码质量、安全性、可玩性、学习有效性、学术规范

---

## 一、总览

| 审查维度 | 🔴 严重 | 🟠 高危 | 🟡 中等 | 🔵 低危 |
|---------|---------|---------|---------|---------|
| **游戏引擎 (Phaser)** | 4 | 6 | 8 | 5 |
| **前端组件 (Vue/CSS)** | 2 | 5 | 7 | 8 |
| **后端 API / 安全** | 1 | 9 | 14 | 11 |
| **游戏设计 / 可玩性** | 3 | 4 | 6 | 5 |
| **合计** | **10** | **24** | **35** | **29** |

---

## 二、🔴 严重问题（必修）

### 1. `shutdown()` 从未被 Phaser 注册 — 事件监听器永远不清理
**文件**: `WorldScene.js`, `MenuScene.js`, `ResultScene.js`

Phaser 3 **不会**自动调用类方法 `shutdown()`。必须手动注册：
```js
this.events.on('shutdown', this.shutdown, this)
```
**后果**: 每次场景切换，4 个 eventBus 监听器累积。切换 10 次后，一次答题会触发 `onQuizAnswered` 10 次，操作已销毁的对象导致崩溃。**这是整个代码库最严重的 Bug。**

### 2. XSS + Token 泄露链 — 可完整接管账号
**文件**: `ChatPanel.vue` 第 26 行, `stores/user.js`

```html
<p class="message-text" v-html="msg.content"></p>  <!-- 服务器内容直接渲染为HTML -->
```
AI/服务器返回 `<img src=x onerror=alert(document.cookie)>` 即可执行任意 JS。同时 JWT Token 存储在 `localStorage`，XSS 可直接窃取，**完成账号接管**。

### 3. JWT 密钥硬编码提交到仓库
**文件**: `server/.env`（无 `.gitignore`）
```
JWT_SECRET=word_quest_jwt_secret_key_2024
```
任何仓库访问者可伪造任意用户的 JWT Token。

### 4. 答错怪物永远消失 — 学习核心逻辑缺陷
**文件**: `WorldScene.js` 第 509-518 行

答错的怪物 `setData('defeated', true)` + `setAlpha(0.3)`，**永远不会再次触发**。错误的单词被消耗后再也不会重测。这与间隔重复（Spaced Repetition）理论完全矛盾 —— **失败的词恰恰最需要重复练习**。

### 5. 答题弹窗点击背景可跳过答题
**文件**: `QuizModal.vue` 第 2 行
```html
<div class="quiz-modal-overlay" @click.self="$emit('close')">
```
点击遮罩层直接关闭弹窗，不提交任何答案。GameView 中游戏恢复运行，怪物遭遇被**免费跳过** —— 这是一个作弊漏洞。

### 6. MongoDB 聚合查询全部返回空数据
**文件**: `server/src/routes/learning.js` 第 73, 94, 123, 159 行

```js
{ $match: { userId: req.userId, ... } }  // req.userId 是字符串，但数据库中是 ObjectId
```
Mongoose 的 `aggregate()` **不会**自动类型转换。`daily-stats`, `chapter-stats`, `top-mistakes`, `heatmap` 四个接口**永远返回空数组**。学习报告页面看不到任何数据。

### 7. 草地瓦片渲染错误 — setCrop + setScale + setDisplaySize 冲突
**文件**: `WorldScene.js` 第 150-152 行
```js
tile.setCrop(cropX, cropY, 16, 16)
tile.setScale(2)
tile.setDisplaySize(tileSize, tileSize) // 32
```
`setDisplaySize` 覆盖 `setScale`，但 `setCrop` 作用于完整 176×112 图片。实际效果：整张 tileset 被压缩到 32×32 再裁剪，**地面显示为扭曲的混乱图像**。

---

## 三、🟠 高危问题

### 游戏引擎层

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| H1 | **对角线移动速度 +41%** | WorldScene.js:608 | `vx=160, vy=160` → 实际速度 226，未做向量归一化 |
| H2 | **素材加载失败后 fallback 不生效** | BootScene.js:164,286 | `loaderror` 只打日志。`textures.exists()` 对失败的加载也返回 true（Phaser 创建错误纹理），fallback 代码永远不执行 |
| H3 | **双重 HUD 叠加** | WorldScene.js + GameView.vue | Phaser 场景画了一套 HUD，Vue 层又画了一套，两个完全重叠 |
| H4 | **NPC 弹开可穿墙** | WorldScene.js:462-466 | 直接设置 `player.x/y` 绕过物理碰撞，玩家可被推出边界 |
| H5 | **隐形按钮可点击** | ResultScene.js:190 | hitArea 立即 `setInteractive()`，但按钮视觉 3000ms 后才出现 |
| H6 | **Stream 未取消 — 内存泄漏** | ChatPanel.vue:122-151 | 组件销毁时 `reader.read()` 继续运行，操作已卸载的 reactive 数据 |

### 后端/安全层

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| H7 | **NoSQL 正则注入** | vocabulary.js:60-64 | `$regex: q` 无转义，`q=.*` 可导出全库 |
| H8 | **请求体 Mass Assignment** | learning.js:12-15 | `...req.body` 直接展开，可注入 `_id`, `userId` 等任意字段 |
| H9 | **CORS 完全开放** | app.js:16 | `cors()` 无限制，任何网站可跨域调用 API |
| H10 | **无速率限制** | 注册、聊天、游戏接口 | LLM 聊天接口无限制 → API 额度耗尽；注册无限制 → 批量注册 |
| H11 | **游戏分数无服务端校验** | game.js:23-31 | 客户端可提交 `score: 999999999`，直接污染排行榜 |
| H12 | **Dockerfile 打包 .env** | Dockerfile:8 | `COPY . .` 将密钥文件打入镜像 |

---

## 四、🟡 中等问题

### 游戏体验
| 问题 | 说明 |
|------|------|
| **无声音效果** | 整个游戏零音频：答对/答错/按钮/怪物/通关全部静音，游戏感极差 |
| **小鸡太小** | 16×16 scale(2)=32px vs 玩家 48×48 scale(1.8)=86px，怪物只有玩家 37% 大小 |
| **行走动画=加速的idle** | walk 和 idle 用同一组帧，角色移动时像"滑行" |
| **地图=单屏** | 30×20 × 32px = 960×640 = 正好一屏，camera follow 毫无意义 |
| **怪物与单词不对应** | 怪物有空间分布，但单词是顺序出题，探索完全没有意义 |
| **"+100" 硬编码** | `spawnCoinEffect` 永远显示 +100，但实际得分可能是 350+ |
| **Google Fonts 被中国防火墙封锁** | `fonts.googleapis.com` 在国内无法访问，字体加载失败 |
| **选项双重随机** | GameView 和 QuizModal 各 shuffle 一次，Vue 重渲染时选项会重新排列 |
| **成就系统完全失效** | `checkAchievements()` 从未被调用，achievements 全是死代码 |
| **无暂停菜单** | 游戏中无法暂停/返回/设置 |

### 代码质量
| 问题 | 说明 |
|------|------|
| **LevelManager 与 gameStore 状态重复** | `lives/score/combo` 在两处维护，可能不同步 |
| **Magic Numbers 遍布** | `80,300` `700,300` `960` `640` `160` 等无常量定义 |
| **Entity 类(Player/Monster/NPC)全是死代码** | 从未被 import，WorldScene 内联创建一切 |
| **`@keyframes` 同名不同值** | `fadeIn` 在 global.scss / QuizModal / AchievementPopup 定义了 3 次，值不同 |
| **路由 chunk 加载失败 → 无限刷新** | `import().catch(() => window.location.reload())` 无重试计数 |
| **Math.random() 在 Vue template 中** | HomeView 的树叶每次重渲染位置跳变 |
| **用户被锁在游戏中** | 已登录用户被强制跳转 /game，无登出按钮，无法回到首页 |

---

## 五、🎮 可玩性评估

### 核心循环评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **探索乐趣** | ⭐☆☆☆☆ | 单屏平地，无房间/路径/隐藏区，装饰物无碰撞 |
| **战斗紧张感** | ⭐⭐☆☆☆ | 有倒计时和连击，但无音效、无视觉冲击 |
| **奖励满足感** | ⭐⭐☆☆☆ | 金币特效不错，但 EXP/星级/成就全部无实际意义 |
| **学习有效性** | ⭐⭐☆☆☆ | 有 AI 辅导很好，但无间隔重复、错词不重测、题型单一 |
| **重复可玩性** | ⭐☆☆☆☆ | 同样地图、同样顺序、无最佳成绩记录、无挑战模式 |
| **视觉风格** | ⭐⭐⭐⭐☆ | Sprout Lands 素材风格统一可爱，田园配色和谐 |
| **UI/UX 流畅度** | ⭐⭐☆☆☆ | 木质面板有质感，但双重 HUD、无暂停、不支持手机 |

### 关键缺失功能

| 功能 | 紧迫度 | 学术影响 |
|------|--------|---------|
| 错词重测队列 | 🔴 必须 | 答辩核心论点 |
| 音效系统 | 🔴 必须 | 游戏体验基本要素 |
| 关卡选择/世界地图 | 🟠 重要 | 进度可视化 |
| 间隔重复算法 | 🟠 重要 | 学术创新点 |
| 暂停菜单 | 🟠 重要 | 基本 UX |
| 多种题型 | 🟡 建议 | 学习深度 |
| 手机触控 | 🟡 建议 | 用户覆盖 |
| 前后测对比 | 🟡 建议 | 学术实证 |

---

## 六、🎓 毕业设计学术评估

| 评估项 | 现状 | 建议 |
|--------|------|------|
| **测试覆盖** | ❌ 零测试文件 | 至少添加核心逻辑单元测试 |
| **API 文档** | ❌ 无 Swagger/README | 添加 API 文档 |
| **服务端验证** | ❌ 评分完全客户端计算 | `scoringService.js` 已写但从未调用 |
| **数据分析** | ❌ 聚合查询全返空 | 修复 ObjectId 类型转换 |
| **安全防护** | ❌ 无 Helmet/限流/输入校验 | 基本安全中间件 |
| **代码规范** | ⚠️ 大量死代码和重复 | 清理 Entity 类，提取公共方法 |

---

## 七、Top 10 优先修复项

| 优先级 | 修复项 | 预计工时 |
|--------|--------|---------|
| **P0** | 注册 `shutdown` 场景事件（3个文件加1行） | 5 分钟 |
| **P0** | 移除 QuizModal overlay 的 `@click.self` | 1 分钟 |
| **P0** | `v-html` → `v-text` 或 DOMPurify 消毒 | 10 分钟 |
| **P0** | 修复草地 setCrop/setScale 冲突 | 30 分钟 |
| **P1** | 答错怪物重新加入答题队列 | 1 小时 |
| **P1** | 修复 MongoDB 聚合查询 ObjectId 类型 | 30 分钟 |
| **P1** | 添加 .gitignore + 轮换 JWT Secret | 10 分钟 |
| **P1** | 修复对角线移动速度归一化 | 10 分钟 |
| **P2** | 添加基础音效（5-6个） | 2 小时 |
| **P2** | 删除双重 HUD，统一为一套 | 30 分钟 |

---

## 八、详细技术发现（按文件）

### BootScene.js

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| 素材路径含空格 | 69, 174 | 🟡 | `Sprout Lands - Sprites - Basic pack` 在某些服务器上会失败 |
| loaderror 无实际 fallback | 164-166 | 🟠 | 只打日志，Phaser 错误纹理导致 `textures.exists()` 返回 true |
| load.on 监听器不清理 | 48, 53, 164 | 🟡 | BootScene 重入时监听器累积 |
| Chest spritesheet 帧尺寸猜测 | 141-146 | 🟡 | 注释写 "let's do 48x48?" — 开发者不确定 |
| btn_blue 实际是绿色 | 486-494 | 🔵 | 兼容旧 key 但颜色错误 |

### WorldScene.js

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| shutdown() 未注册 | 641-646 | 🔴 | 事件监听器永不清理，累积导致崩溃 |
| setCrop+setScale+setDisplaySize 冲突 | 150-152 | 🔴 | 草地渲染错误 |
| 对角线移动 +41% | 608-614 | 🟠 | 未归一化向量 |
| isPaused 答错后不重置 | 509-518 | 🟠 | 依赖 Vue 层事件恢复 |
| NPC 弹开绕过物理 | 462-466 | 🟠 | 直接设 x/y 可穿墙 |
| textures.exists() 每帧调用 | 617 | 🟡 | 应缓存到 create() |
| monsterLabels 销毁后引用泄漏 | 493-494 | 🟡 | destroyed 对象引用未置空 |
| 600+ 游戏对象每次重建 | 115-163 | 🟡 | GC 压力大 |

### MenuScene.js

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| shutdown() 未注册 | 213-215 | 🔴 | 12 个无限循环 tween 永不停止 |
| 按钮无双击保护 | 210 | 🟡 | 快速双击触发两次场景切换 |

### ResultScene.js

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| shutdown() 未注册 | 217-219 | 🔴 | tween 不清理 |
| 隐形按钮可点击 | 190 | 🟠 | hitArea 立即交互，视觉 3s 后出现 |
| 无"游戏通关"状态 | 123-126 | 🟡 | 最后一章最后一关 → 回到第6章第1关 |
| createWoodButton 重复代码 | — | 🟡 | 与 MenuScene 重复，应提取 |

### HomeView.vue

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| Math.random() 在 template | 5-14 | 🟡 | 重渲染时树叶位置跳变 |
| label 未关联 input | 33-44 | 🟡 | 无障碍访问问题 |
| font-family 未引号 | 153 | 🟡 | `Microsoft YaHei` 多词名需引号 |

### GameView.vue

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| 事件监听在 Phaser 之后注册 | 147-178 | 🟠 | 初始化期间事件可能丢失 |
| 双重状态管理 | 293-306 | 🟡 | LevelManager + gameStore 重复 |
| submitQuizRecord 无重试 | 331-345 | 🟡 | 答题记录永久丢失 |
| game over 无恢复 UI | 348-352 | 🟡 | 关闭 quiz 后游戏冻结无提示 |

### QuizModal.vue

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| overlay 点击跳过答题 | 2 | 🔴 | 作弊漏洞 |
| 选项双重 shuffle | 80-82 | 🟠 | 重渲染时选项重排 |
| 无键盘快捷键 | — | 🟡 | 无 A/B/C/D 键选择 |
| 无 ARIA 标记 | — | 🟡 | 屏幕阅读器无法识别模态框 |

### ChatPanel.vue

| 问题 | 行号 | 严重度 | 说明 |
|------|------|--------|------|
| v-html XSS | 26 | 🔴 | 服务器内容直接渲染为 HTML |
| Stream reader 未取消 | 122-151 | 🟠 | 组件卸载后继续运行 |
| [DONE] 只 break 内层循环 | 138-139 | 🟡 | 外层 while 继续 |
| 固定 380px 不响应式 | 186 | 🟡 | 手机上溢出 |

### 后端

| 问题 | 文件 | 严重度 | 说明 |
|------|------|--------|------|
| JWT 密钥硬编码 | .env | 🔴 | 无 .gitignore |
| NoSQL 正则注入 | vocabulary.js:60 | 🟠 | $regex 无转义 |
| Mass Assignment | learning.js:12 | 🟠 | ...req.body 展开 |
| CORS 完全开放 | app.js:16 | 🟠 | 任何源可调用 |
| 无速率限制 | 多文件 | 🟠 | 注册/聊天/游戏均无限制 |
| 分数无服务端校验 | game.js:23 | 🟠 | 客户端可提交任意分数 |
| ObjectId 类型错误 | learning.js:73+ | 🔴 | 聚合查询全返空 |
| 登录限速器内存泄漏 | auth.js:10-23 | 🟡 | Map 无清理 |
| 错误消息泄露内部信息 | 多文件 | 🟡 | err.message 直接返回客户端 |
| 无 Helmet 安全头 | app.js | 🟡 | 缺少安全响应头 |
| Dockerfile 打包 .env | Dockerfile:8 | 🟠 | 密钥进入镜像 |
| analyticsService 死代码 | services/ | 🟡 | 已写但从未调用 |
| scoringService 死代码 | services/ | 🟡 | 评分完全客户端计算 |

---

## 九、总结

> **项目视觉风格出色**（田园像素风统一完整），**架构设计合理**（Phaser+Vue+AI 三层解耦），但存在 **10 个严重 Bug**（其中多个会导致游戏崩溃或安全漏洞）和**核心学习逻辑缺陷**（错词不重测）。建议按 P0→P1→P2 顺序修复，预计 **6-8 小时**可完成所有关键修复，使项目达到毕设答辩水准。
