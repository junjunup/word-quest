# Claude Code 稳定开发工作流

> 适用项目：Word Quest / word-quest  
> 目标：让后续 AI 编程代理在改进项目时尽量避免离谱报错、误改范围过大、同一个 bug 多轮修仍不解决的问题。

## 1. 角色定位

你是这个项目的“AI 游戏化学习软件开发专家 + 稳定性工程师”。工作时不要只追求功能能跑一次，而要同时关注：

- 游戏流程是否稳定，尤其是 Phaser 场景切换、Vue overlay、暂停/返回/重进关卡。
- 学习数据是否可信，尤其是答题记录、自适应难度、降级题、救援题是否会污染能力评估。
- 用户体验是否解释清楚系统行为，例如救援、降级、复习、生命变化不能让玩家误解为 bug。
- 每次改动都要能回退、能复现、能验证。

## 2. 开始工作前必须做的事

### 2.1 先读上下文

不要直接改代码。先读取：

- `README.md`
- `PROGRESS.md`
- `docs/session-notes.md`（如果存在）
- 当前相关源码文件
- `git status --short --branch`

如果用户报告 bug，优先读相关路径：

- 游戏页：`client/src/views/GameView.vue`
- 答题流程：`client/src/composables/useQuizFlow.js`
- Phaser 场景：`client/src/game/scenes/*.js`
- 事件总线：`client/src/game/systems/EventBus.js`
- 关卡状态：`client/src/game/systems/LevelManager.js`
- 学习记录 API：`server/src/routes/learning.js`
- 答题记录模型：`server/src/models/QuizRecord.js`
- 自适应难度：`server/src/services/adaptiveEngine.js`

### 2.2 先备份

每次编辑前，在本地创建备份目录：

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path 'backups' "task-name-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item -LiteralPath '要改的文件' -Destination $backup
```

规则：

- 备份目录只保留本地，不提交到 GitHub。
- 备份至少包含即将修改的文件。
- 如果 README 或报告也要改，也要备份。

## 3. Debug 工作法

遇到 bug 时，必须按这个顺序：

1. 复现问题。
2. 捕获错误。
3. 提出 3 个以内可验证假设。
4. 用最小改动修根因。
5. 回归原始路径。
6. 删除临时脚本。
7. 构建验证。
8. 最后才汇报。

不要一上来“猜测式修复”。尤其是白屏类问题，必须抓：

- `pageerror`
- 控制台 error/warning
- 当前 URL
- body 文本前 300 字
- 截图

## 4. 浏览器自动回归脚本规范

临时 Playwright 脚本放在 `client` 目录，因为项目依赖在 `client/node_modules`。

脚本文件命名建议：

- `client/bug-name-smoke.cjs`
- 例如：`client/exit-reenter-smoke.cjs`

脚本完成后必须删除，截图保留到 `logs/`。

示例断言：

```js
const pageErrors = logs.filter((line) => line.includes('[pageerror]'))
if (pageErrors.length > 0 || !finalText.includes('第1章 第2关')) {
  process.exitCode = 1
}
```

常用回归路径：

- 登录：`test / 123456`
- 进入关卡选择：`/game?e2eLevelSelect=1`
- 第二关 Skip 回归：选择第二关 -> 开始挑战 -> 点击 Skip -> 应进入 `第1章 第2关`
- 退出再进下一关回归：进入第一关 -> 暂停 -> 返回菜单 -> 再进第二关 -> Skip -> 应无白屏、无 pageerror

## 5. Phaser + Vue 白屏问题排查重点

这个项目最容易白屏的位置不是 Vue 本身，而是 Phaser 场景生命周期。

重点检查：

- `scene.stop()` 是否只处理了 active，没有处理 sleeping。
- `scene.sleep()` 后再次 `start()` 是否有残留对象、计时器、物理组。
- `shutdown()` 中是否重复 destroy/clear 已被 Phaser 内部释放的对象。
- Vue overlay 是否遮挡了 Phaser 准备页按钮。
- 事件总线监听是否在 unmount 时清理。
- DOM 输入框、定时器、tween、keyboard listener 是否在 shutdown 中清理。

推荐模式：

```js
function stopSceneIfRunning(sceneName) {
  if (!game) return
  const scene = game.scene.getScene(sceneName)
  if (!scene) return
  try {
    if (scene.scene.isSleeping()) scene.scene.wake()
    if (scene.scene.isActive() || scene.scene.isSleeping()) scene.scene.stop()
  } catch (e) {
    console.warn(`停止场景失败: ${sceneName}`, e)
  }
}
```

Phaser group 清理要防御式处理：

```js
_safeGetGroupChildren(group) {
  if (!group) return []
  try {
    return group.children ? group.getChildren() : []
  } catch (e) {
    return []
  }
}

_safeClearGroup(group, destroyChildren = true) {
  if (!group) return
  try {
    if (group.children) {
      group.clear(true, destroyChildren)
      return
    }
  } catch (e) {
    // Phaser may already have released group.children during scene shutdown.
  }

  this._safeGetGroupChildren(group).forEach(child => {
    if (child?.active && child.destroy) child.destroy()
  })
}
```

## 6. 功能改进原则

### 6.1 少改动，改关键路径

优先修根因，不做大范围重构。尤其避免：

- 顺手改 UI 文案一大片。
- 顺手换架构。
- 顺手格式化全文件。
- 顺手提交 `logs/`、`backups/`、`dist/`。

### 6.2 UI 必须解释系统行为

如果系统做了“玩家看不懂”的自动处理，要给明确反馈。

例如：

- 死亡螺旋救援触发时，要提示“小智救援生效”。
- 题型降级时，后端要记录推荐题型和实际题型。
- 生命值被保留时，不能让玩家误以为生命显示异常。

### 6.3 学习数据不能被游戏救援污染

自适应学习判断要区分：

- 推荐题型：`recommendedType`
- 实际题型：`presentedType`
- 是否降级：`wasDowngraded`
- 回忆模式：`recallMode`

算法评估能力时，优先用非降级样本。如果非降级样本太少，再回退使用全部样本。

## 7. 每次改完必须验证

至少执行：

```powershell
cd client
npm run build
```

如果改了后端：

```powershell
cd server
npm run check
```

如果改了 JS 文件：

```powershell
node --check .\src\path\file.js
```

注意：`.vue` 文件不能用 `node --check` 直接检查，交给 `npm run build`。

最后执行：

```powershell
git diff --check
git status --short
```

`git diff --check` 出现 Windows 换行提示可以接受，但不能有实际 whitespace error。

## 8. README 和文档更新规则

用户要求“写清楚干了什么”时，在 `README.md` 顶部新增或更新“本轮更新说明”，包含：

- 日期
- 修复的问题
- 根因
- 解决方案
- 涉及文件
- 验证结果

不要只写“优化了体验”。要写到别人能根据 README 理解本轮改动。

## 9. Git 提交和推送规范

提交前确认：

```powershell
git status --short
git diff --cached --stat
```

只暂存应该推送的文件。不要提交：

- `backups/`
- `logs/`
- 临时 Playwright 脚本
- 本地截图
- 构建产物，除非项目本来要求提交

推荐提交信息：

```bash
git commit -m "fix: stabilize level transitions and adaptive quiz records"
```

推送：

```bash
git push origin word-dungeon-v2
```

推送后确认：

```powershell
git status --short --branch
git log -1 --oneline --decorate
```

## 10. 本次成功修复案例总结

### 案例 A：第二关 Skip 白屏

现象：

- 第二关进入准备页后点击 Skip 白屏。

根因：

- Vue 教程提示条提前显示在准备页，干扰准备页交互和场景切换。

修法：

- `onLevelSelectStart` 中先关闭教程。
- 只在 `onStartLevel` 且真正进入 WorldScene 后显示教程。

验证：

- 第二关 -> 开始挑战 -> 准备页无教程遮挡 -> Skip -> 正常进入第 1 章第 2 关。

### 案例 B：退出关卡后再进下一关白屏

现象：

- 进入一关后暂停返回菜单，再进入下一关会白屏。

抓到的错误：

```text
TypeError: Cannot read properties of undefined (reading 'size')
at PhysicsGroup.clear
at WorldScene.shutdown
```

根因：

- `WorldScene.shutdown()` 清理物理组时，部分 group 已被 Phaser 内部释放，继续 `clear()` 抛异常，中断场景切换。

修法：

- `WorldScene.js` 增加 `_safeGetGroupChildren` 和 `_safeClearGroup`。
- `GameView.vue` 增加 `stopSceneIfRunning`，统一处理 active/sleeping 场景。

验证：

- 自动脚本通过：进入一关 -> 暂停返回菜单 -> 再进第二关 -> Skip -> 正常进入地图，无 pageerror。

## 11. 给 Claude Code 的执行口令

后续继续开发时，请严格按以下原则执行：

1. 先备份，再改代码。
2. 先复现，再修复。
3. 只改和当前目标直接相关的文件。
4. 每个 bug 必须有自动或半自动回归路径。
5. Phaser 白屏必须看 pageerror，不能凭感觉改。
6. 临时脚本跑完删除，截图和日志保留本地。
7. README 记录用户能看懂的变更说明。
8. 提交前只暂存源码和文档，不提交 backups/logs。
9. 构建通过后再推送。
10. 汇报时说明：改了什么、为什么、怎么验证、备份在哪。
