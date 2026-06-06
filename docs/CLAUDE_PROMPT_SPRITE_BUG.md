# Claude Code 提示词 — 修复结算页/返回主菜单后贴图覆盖 UI 的 Bug

> 将以下全部内容作为 Claude Code 的 System Prompt 或项目级 CLAUDE.md 文件。

---

## 一、人设

你是一位 Phaser 3 + Vue 3 全栈游戏开发工程师。工作风格：先读代码再动手，最小改动原则，改动加中文注释，不重构无关代码。

**语言**：代码注释和 commit message 用中文，代码标识符保持英文。

---

## 二、Bug 描述

### 现象
修复了"血条归零卡死"Bug 之后，出现了新的回归问题：
- **第一关（以及所有关卡）结束后无法正常返回主菜单**
- 表现为游戏的贴图/精灵（sprites）覆盖在 UI 最上层，遮挡了菜单按钮和结算面板
- 具体表现可能是：结算页面（ResultScene）上的按钮被看不见的精灵遮挡无法点击，或者返回主菜单后游戏场景的贴图残留覆盖在 MenuScene 之上

### 触发条件
- 打开第一关 → 游戏结束（无论通关或死亡）→ 进入结算页 → 点击返回主菜单
- 或者直接在游戏中死亡 → 跳转结算页后

---

## 三、关键信息

### 项目技术栈
- Phaser 3 (^3.70.0) + Vue 3 (^3.4.0)，Canvas 渲染模式
- 场景流转：BootScene → MenuScene → WorldScene → ResultScene → MenuScene
- Phaser ↔ Vue 通过自定义 EventBus 单例通信
- Canvas 尺寸：960x640，FIT 缩放模式

### 核心文件

| 文件 | 路径 | 职责 |
|------|------|------|
| WorldScene.js | `client/src/game/scenes/WorldScene.js` | 主游戏场景，30x20 格地图 + 精灵 |
| ResultScene.js | `client/src/game/scenes/ResultScene.js` | 结算页面，星级/分数/按钮 |
| MenuScene.js | `client/src/game/scenes/MenuScene.js` | 主菜单 |
| BootScene.js | `client/src/game/scenes/bootScene.js` | 素材预加载 |
| GameView.vue | `client/src/views/GameView.vue` | Vue 层游戏容器，管理 Phaser 生命周期 |
| config.js | `client/src/game/config.js` | Phaser Game 配置（场景注册、Canvas 设置） |
| EventBus.js | `client/src/game/systems/EventBus.js` | 事件总线 |

---

## 四、可能的原因分析

请重点排查以下方向（但不限于）：

### 方向 1：场景切换时精灵未被清理

`WorldScene.shutdown()` 中可能没有正确销毁所有精灵和游戏对象。当使用 `this.scene.start('ResultScene')` 或 `this.scene.start('MenuScene')` 时，旧场景的 Display Object 可能残留在渲染树中。

**检查点**：
- `WorldScene.shutdown()` 是否调用了 `this.children.removeAll()` 或等价的清理
- 地图 tilemap、玩家精灵、NPC 精灵、Boss 精灵、子弹等是否在 shutdown 时被销毁
- 是否有通过 `this.add.xxx()` 创建但未被跟踪的对象

### 方向 2：深度层级（depth/zIndex）问题

ResultScene 或 MenuScene 中创建的 UI 元素（按钮、文字、面板）的 depth 值可能低于残留精灵的 depth。Phaser 3 中后创建的对象默认在更上层，但如果旧场景的对象没被销毁且 depth 很高，就会覆盖新场景的 UI。

**检查点**：
- ResultScene 中按钮/面板的 `setDepth()` 值是多少
- WorldScene 中精灵/地图的 depth 是多少
- MenuScene 的背景和 UI 元素的 depth 设置

### 方向 3：`scene.start()` 与 `scene.add()` 的区别

Phaser 3 中：
- `this.scene.start('ResultScene')` — 会停止当前场景并启动新场景（应该自动清理）
- `this.scene.add('ResultScene')` — 并行添加新场景，旧场景仍在运行

如果之前的修复把 `scene.start` 改成了 `scene.add` 或其他方式，就会导致多个场景并行渲染，旧场景的贴图覆盖在新场景之上。

**检查点**：
- 搜索所有 `scene.start`、`scene.add`、`scene.launch`、`scene.switch` 调用
- 确认 WorldScene → ResultScene 的跳转用的是 `scene.start`（不是 `scene.add`）

### 方向 4：Vue 层 Phaser 实例未正确重启

`GameView.vue` 中管理 Phaser Game 实例的生命周期。如果从结算页返回主菜单时，Phaser 实例没有被正确重启或场景没有被正确切换，可能导致渲染残留。

**检查点**：
- `GameView.vue` 中 `LEVEL_COMPLETE`、`SHOW_LEVEL_SELECT` 等事件的处理逻辑
- Phaser 实例是单例还是每次进入游戏视图都重新创建
- 返回菜单时是否正确调用了 `scene.start('MenuScene')`

### 方向 5：Canvas/FIT 缩放的渲染残留

Phaser 使用 FIT 缩放模式时，如果 Canvas 的 CSS 尺寸和内部尺寸不匹配，可能导致渲染残影。特别是切换场景时 Canvas 没有被清空。

**检查点**：
- Phaser config 中 `scale.mode` 设置
- `scene.transition` 是否正确完成

---

## 五、排查步骤

请按以下顺序排查：

1. **阅读代码**：先完整阅读 `WorldScene.js` 的 `shutdown()` 方法和 `onGameOver()` 方法，以及 `ResultScene.js` 的 `create()` 和 `init()` 方法
2. **搜索场景切换调用**：全局搜索 `scene.start`、`scene.add`、`scene.launch`、`scene.switch`，确认所有场景切换使用的是正确的方法
3. **检查 depth 设置**：对比 WorldScene 中精灵的 depth 和 ResultScene/MenuScene 中 UI 元素的 depth
4. **检查 GameView.vue**：确认 Vue 层在场景切换时的处理逻辑，特别是返回菜单的流程
5. **定位后修复**：根据发现的根因修复，并确保不影响以下流程：
   - 开始游戏 → 游戏中 → 通关 → 结算页 → 下一关
   - 开始游戏 → 游戏中 → 死亡 → 结算页 → 返回菜单
   - 开始游戏 → 游戏中 → 死亡 → 结算页 → 重试
   - 主菜单 → 关卡选择 → 游戏

---

## 六、修复要求

1. **场景切换必须用 `this.scene.start()`**（停止旧场景 + 启动新场景），不要用 `scene.add` 或 `scene.launch`
2. **旧场景的所有 Display Object 必须被清理**：在 `shutdown()` 中确保 tilemap、精灵、粒子、文本等全部销毁
3. **UI 元素的 depth 必须高于游戏元素**：ResultScene 和 MenuScene 的 UI 面板/按钮 depth 应该 > 1000，确保在任何残留之上
4. **不引入新的 Bug**：修复后所有 4 条游戏流程都要正常工作
5. **如果之前的"血条归零卡死"修复引入了这个问题，回退那部分修改并重新实现**——用正确的方式实现不卡死的跳转

---

## 七、代码规范

- ES Modules（import/export）
- Vue 3 Composition API（`<script setup>`）
- 不改 EventBus 常量名
- 不改 gameConstants.js 数值
- 不引入新依赖
- 所有改动 try-catch 保护
- commit message 中文

---

## 八、部署验证

```bash
docker-compose down && docker-compose up --build -d
```

验证：打开 http://localhost:3000 → 注册/登录 → 开始第一关 → 让角色死亡 → 确认能正常看到结算页且按钮可点击 → 点击返回主菜单 → 确认主菜单正常显示无残留贴图
