# Word Quest 音效与背景音乐功能 PRD

## 1. 背景与目标

Word Quest 当前使用 Phaser 3 + Vue 3 构建，代码中已有完整的 `AudioManager` 单例和 8 个音效的加载/调用逻辑，但因为 `public/assets/audio/` 目录下没有任何音频文件，所有音效播放被静默跳过。

本次需求：
1. 补全所有缺失的音效文件
2. 新增背景音乐（BGM）支持，按场景切换不同曲目
3. 补全未接入的音效调用点

## 2. 现有代码基础

### 已有设施（无需改动）

- **AudioManager** (`client/src/game/systems/AudioManager.js`)：单例模式，支持 `init(scene)` / `play(key)` / `toggleMute()` / `setVolume(v)` / `destroy()`，静音和音量状态通过 localStorage 持久化（key: `wordquest:muted` / `wordquest:volume`）
- **BootScene 预加载**：已循环加载 8 个音效 key：`correct` / `wrong` / `boss_appear` / `boss_defeat` / `combo` / `coin` / `level_complete` / `click`
- **WorldScene 调用**：7 处 `audioManager.play()` 覆盖答题正确/错误、连击、Boss出现/击败、关卡完成、金币
- **GameView.vue**：已有静音切换按钮 UI

### 需要新增的部分

- 背景音乐（BGM）的加载、播放、淡入淡出、场景切换逻辑
- MenuScene 和 ResultScene 的音效接入
- `click` 音效的实际调用（已加载但未使用）

## 3. 功能需求

### 3.1 音效文件

将以下 8 个 mp3 文件放入 `client/public/assets/audio/` 目录：

| 文件名 | 用途 | 风格要求 | 时长建议 |
|--------|------|----------|----------|
| `correct.mp3` | 答题正确 | 清脆上扬，正面反馈 | 0.3-0.5s |
| `wrong.mp3` | 答题错误 | 低沉柔和，不刺耳 | 0.3-0.5s |
| `combo.mp3` | 连击达成（5/10/15…） | 叮叮叠加，比 correct 更强烈 | 0.4-0.6s |
| `coin.mp3` | 金币/击败怪物 | 经典金币音，轻快 | 0.2-0.3s |
| `boss_appear.mp3` | Boss 出现 | 低沉鼓点或号角，紧张感 | 0.8-1.2s |
| `boss_defeat.mp3` | Boss 击败 | 胜利号角，有成就感 | 1.0-1.5s |
| `level_complete.mp3` | 关卡通关 | 欢快小旋律，成就感 | 1.5-2.0s |
| `click.mp3` | 按钮/菜单点击 | 轻微点击声，不突兀 | 0.1-0.15s |

**整体风格**：像素风/复古游戏风格，8-bit 或 chiptune 风格优先，与游戏画面统一。

### 3.2 背景音乐（BGM）

新增 3 首 BGM，放入 `client/public/assets/audio/bgm/` 目录：

| 文件名 | 使用场景 | 风格要求 | 时长 | 循环 |
|--------|----------|----------|------|------|
| `menu.mp3` | MenuScene 主菜单 | 轻松田园风，不抢注意力 | 30-60s | 是 |
| `game.mp3` | WorldScene 游戏中 | 冒险感，中等节奏，不干扰答题 | 60-120s | 是 |
| `result.mp3` | ResultScene 结算 | 正向情绪，根据胜负区分 | 20-40s | 否 |

**BGM 技术要求**：
- 使用 Phaser 的 `this.sound.add(key, { loop: true, volume: 0.3 })` 播放
- 场景切换时旧 BGM 淡出（500ms）+ 新 BGM 淡入（500ms），避免生硬切换
- BGM 音量独立于音效音量，比例约 3:5（BGM 30% / SFX 50%）
- 静音按钮同时控制 BGM 和 SFX

### 3.3 AudioManager 改造

在现有 `AudioManager.js` 基础上新增 BGM 能力：

```javascript
class AudioManager {
  // === 现有属性保持不变 ===
  constructor() {
    this.scene = null
    this.sounds = {}
    this.muted = localStorage.getItem('wordquest:muted') === 'true'
    this.volume = parseFloat(localStorage.getItem('wordquest:volume') || '0.5')
    // === 新增 ===
    this.bgm = null           // 当前 BGM Sound 对象
    this.bgmVolume = 0.3      // BGM 音量（独立于 SFX）
    this.sfxVolume = 0.5      // SFX 音量
  }

  // === 现有方法保持不变 ===
  init(scene) { ... }
  play(key) { ... }
  toggleMute() { ... }
  setVolume(v) { ... }
  destroy() { ... }

  // === 新增方法 ===

  /** 播放 BGM，自动淡入。如果已有 BGM 在播放则先淡出再切换 */
  playBGM(key, fadeInMs = 500) { ... }

  /** 停止当前 BGM，淡出 */
  stopBGM(fadeOutMs = 500) { ... }

  /** 暂停 BGM（用于答题弹窗弹出时） */
  pauseBGM(fadeOutMs = 300) { ... }

  /** 恢复 BGM */
  resumeBGM(fadeInMs = 300) { ... }
}
```

### 3.4 BootScene 改造

在现有 `preload()` 中追加 BGM 加载：

```javascript
// 现有音效加载之后追加
this.load.audio('bgm_menu', '/assets/audio/bgm/menu.mp3')
this.load.audio('bgm_game', '/assets/audio/bgm/game.mp3')
this.load.audio('bgm_result', '/assets/audio/bgm/result.mp3')
```

### 3.5 各场景音频接入

**MenuScene**（新增）：
- `create()` 时调用 `audioManager.playBGM('bgm_menu')`
- 所有按钮的 onClick 回调中调用 `audioManager.play('click')`

**WorldScene**（补充）：
- `create()` 时调用 `audioManager.playBGM('bgm_game')`
- 答题弹窗弹出时 `audioManager.pauseBGM()`，答完关闭时 `audioManager.resumeBGM()`
- 现有 7 处 `play()` 调用保持不变

**ResultScene**（新增）：
- `create()` 时根据胜负调用 `audioManager.playBGM('bgm_result')` + `audioManager.play('level_complete')` 或 `audioManager.play('wrong')`
- 按钮点击调用 `audioManager.play('click')`

### 3.6 GameView.vue UI 增强

现有静音按钮保持不变，可选增强：
- 音量滑块（非必需，如果时间允许）

## 4. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `client/public/assets/audio/*.mp3` | **新增** | 8 个音效文件 |
| `client/public/assets/audio/bgm/*.mp3` | **新增** | 3 个 BGM 文件 |
| `client/src/game/systems/AudioManager.js` | **修改** | 新增 playBGM / stopBGM / pauseBGM / resumeBGM |
| `client/src/game/scenes/BootScene.js` | **修改** | 追加 3 个 BGM 的 preload |
| `client/src/game/scenes/MenuScene.js` | **修改** | 接入 BGM 播放 + click 音效 |
| `client/src/game/scenes/ResultScene.js` | **修改** | 接入 BGM 播放 + click 音效 |
| `client/src/game/scenes/WorldScene.js` | **修改** | 接入 BGM 播放 + 答题弹窗暂停/恢复 BGM |

## 5. 音频资源来源建议

由于是毕业设计项目，音频资源建议从以下免费素材站获取：

- **Freesound** (https://freesound.org) — CC 协议免费音效，搜索 "8-bit" / "chiptune" / "coin" / "correct"
- **Kenney.nl** (https://kenney.nl/assets/category:Audio) — 免费游戏音效包，无需署名
- **OpenGameArt.org** — 搜索 "rpg sound effects" / "chiptune music"
- **incompetech** (https://incompetech.com) — Kevin MacLeod 的免版税 BGM，CC-BY 协议

关键词推荐：
- SFX: `8-bit coin`, `chiptune correct`, `game wrong answer`, `boss battle intro`, `victory fanfare`, `UI click`
- BGM: `chiptune adventure loop`, `8-bit menu music`, `RPG victory theme`

## 6. 验收标准

- [ ] 8 个音效文件全部就位，WorldScene 中答题正确/错误/连击/Boss/金币/通关均有对应音效
- [ ] 3 首 BGM 按场景自动切换，有淡入淡出过渡
- [ ] 静音按钮能同时控制 BGM 和 SFX
- [ ] 刷新页面后音量/静音状态保持（localStorage）
- [ ] 答题弹窗弹出时 BGM 自动降低/暂停，关闭后恢复
- [ ] 所有音频文件总大小控制在 5MB 以内（单个 MP3 ≤ 500KB）
- [ ] 不影响现有游戏逻辑，音频加载失败时静默降级（现有容错机制已覆盖）
