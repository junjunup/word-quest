/**
 * CombatSystem — 战术暂停战斗
 * 提取自 WorldScene：锁定目标、选择面板、击杀、浮字、金币特效
 */
import Phaser from 'phaser'
import audioManager from './AudioManager'
import levelManager from './LevelManager'
import eventBus, { EVENTS } from './EventBus'
import inventory from './Inventory'
import { evaluateSpellingAnswer } from '../../utils/helpers'

/**
 * 在 scene 上创建战斗系统
 * @param {Phaser.Scene} scene — WorldScene 实例
 * @returns {object} 战斗 API
 */
export function createCombatSystem(scene) {
  const api = { scene }

  /** 尝试 E 键锁定最近怪物 */
  api.tryLockTarget = function () {
    if (scene.targetLocked || !scene.player) return
    const lockRange = scene.weaponId === 'bow' ? 500 : 250
    let closest = null, closestDist = lockRange
    if (!scene.monsters) return
    const children = scene.monsters.getChildren()
    for (let i = 0; i < children.length; i++) {
      const m = children[i]; const idx = m.getData('index')
      const ai = scene.monsterAIs[idx]
      if (!m.active || !ai || ai.isDefeated) continue
      const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, m.x, m.y)
      if (dist < closestDist) { closestDist = dist; closest = { monster: m, ai, idx } }
    }
    if (!closest) return

    const word = levelManager.getCurrentWord()
    if (!word) return
    levelManager.nextWord()

    // 随机题型：40% 英→中, 35% 中→英, 25% 拼写
    const roll = Math.random()
    const qType = roll < 0.4 ? 'choice_en2cn' : roll < 0.75 ? 'choice_cn2en' : 'spell_hint'

    scene.targetLocked = true
    scene.lockedTarget = { ...closest, word, qType }
    scene.timeScale = 0.2
    scene.isPaused = true
    audioManager.pauseBGM(200)

    if (qType === 'spell_hint') {
      // 拼写模式：显示英文单词，玩家输入
      scene.lockedTarget.correctAnswer = word.word
      scene.monsterLabels?.[closest.idx]?.setText(word.word)
      showSpellInput(scene, word)
    } else {
      // 选择题模式
      const others = levelManager.words.filter(w =>
        (qType === 'choice_en2cn' ? w.meaning : w.word) !== (qType === 'choice_en2cn' ? word.meaning : word.word)
      )
      const correct = qType === 'choice_en2cn' ? word.meaning : word.word
      const distractorKey = qType === 'choice_en2cn' ? 'meaning' : 'word'

      const unique = [...new Set(others.map(w => w[distractorKey]).filter(Boolean))]
      const shuffled = unique.sort(() => Math.random() - 0.5).slice(0, 3)
      const fallbacksCn = ['苹果','香蕉','橙子','葡萄','书本','电脑','学校','朋友']
      const fallbacksEn = ['apple','banana','orange','grape','book','computer','school','friend']
      const fallbacks = qType === 'choice_en2cn' ? fallbacksCn : fallbacksEn
      while (shuffled.length < 3) {
        const fb = fallbacks.find(f => f !== correct && !shuffled.includes(f))
        if (fb) shuffled.push(fb); else break
      }
      const options = [correct, ...shuffled].sort(() => Math.random() - 0.5)
      scene.lockedTarget.options = options
      scene.lockedTarget.correctIdx = options.indexOf(correct) + 1

      const promptText = qType === 'choice_en2cn' ? word.word : word.meaning
      scene.monsterLabels?.[closest.idx]?.setText(promptText)
      createChoicePanel(scene, promptText, options, qType)
    }
  }

  /** 取消锁定 */
  api.cancelLock = function () {
    if (!scene.targetLocked) return
    const lt = scene.lockedTarget
    if (lt && scene.monsterLabels?.[lt.idx]) {
      const ai = scene.monsterAIs[lt.idx]
      scene.monsterLabels[lt.idx].setText(ai?.isDefeated ? '💀' : '❓')
    }
    destroyChoicePanel(scene)
    scene.targetLocked = false
    scene.lockedTarget = null
    scene.timeScale = 1.0
    if (Object.keys(scene.monsterAIs || {}).length > 0) {
      scene.isPaused = false
      audioManager.resumeBGM(200)
    }
  }

  /** 击杀怪物 */
  api.killMonster = function (idx, bonusGold = 0) {
    const ai = scene.monsterAIs?.[idx]
    if (!ai || ai.isDefeated) return
    const monster = ai.monster
    if (!monster || !monster.active) return
    ai.defeat()
    delete scene.monsterAIs[idx]
    // Death particle burst
    for (let i = 0; i < 6; i++) {
      const px = monster.x + Phaser.Math.Between(-10, 10)
      const py = monster.y + Phaser.Math.Between(-10, 10)
      const part = scene.add.image(px, py, 'boss_particle').setDepth(20).setScale(1.5)
      scene.tweens.add({
        targets: part, alpha: 0, scale: 0,
        x: px + Phaser.Math.Between(-20, 20),
        y: py - Phaser.Math.Between(10, 30),
        duration: 400, delay: i * 40,
        onComplete: () => part.destroy()
      })
    }
    scene.tweens.add({ targets: monster, alpha: 0, scale: 0, y: monster.y - 30, duration: 400, ease: "Back.easeIn", onComplete: () => {
      const shadow = monster.getData('shadow')
      if (shadow) shadow.destroy()
      monster.destroy()
    }})
    if (scene.monsterLabels?.[idx]) { scene.monsterLabels[idx].destroy(); scene.monsterLabels[idx] = null }
    const wealthMult = scene.blessingId === 'wealth' ? 1.5 : 1.0
    const totalGold = Math.floor((100 + bonusGold) * wealthMult)
    api.spawnCoinEffect(monster.x, monster.y, totalGold)
    audioManager.play("correct")
    levelManager.score += 100
    eventBus.emit(EVENTS.UPDATE_HUD, { score: levelManager.score, lives: levelManager.lives })

    // All monsters defeated?
    if (Object.keys(scene.monsterAIs).length === 0) {
      destroyChoicePanel(scene)
      scene.targetLocked = false
      scene.lockedTarget = null
      scene.timeScale = 1.0
      scene.isPaused = false
      audioManager.resumeBGM(200)
      audioManager.play('level_complete')
      if (scene.extractionPoint) {
        scene.extractionPoint.activate()
        api.showFloatingText(scene.player.x, scene.player.y - 20, 'All clear! Go extract!')
      }
    }
  }

  /** 冻结随机怪物 */
  api.freezeRandomMonster = function (excludeIdx) {
    const keys = Object.keys(scene.monsterAIs || {}).filter(k => String(k) !== String(excludeIdx))
    if (keys.length === 0) return
    const targetIdx = keys[Phaser.Math.Between(0, keys.length - 1)]
    const ai = scene.monsterAIs[targetIdx]
    if (ai && !ai.isDefeated) {
      ai.freeze(2000)
      if (scene.monsterLabels?.[targetIdx]) {
        scene.monsterLabels[targetIdx].setText('❄️')
        scene.time.delayedCall(2000, () => {
          if (scene.monsterLabels?.[targetIdx]?.active) {
            scene.monsterLabels[targetIdx].setText('❓')
          }
        })
      }
    }
  }

  /** 浮字特效 */
  api.showFloatingText = function (x, y, text) {
    const t = scene.add.text(x, y, text, {
      fontSize: '16px', fontFamily: '"Press Start 2P", monospace',
      color: '#ffd700', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(100)
    scene.tweens.add({
      targets: t, y: y - 40, alpha: 0, duration: 1200,
      onComplete: () => t.destroy()
    })
  }

  /** 金币特效 */
  api.spawnCoinEffect = function (x, y, score) {
    audioManager.play("coin")
    for (let i = 0; i < 5; i++) {
      const coin = scene.add.image(x, y, "coin").setDepth(20).setScale(1.5)
      scene.tweens.add({
        targets: coin, x: x + Phaser.Math.Between(-40, 40), y: y - Phaser.Math.Between(30, 80),
        alpha: 0, duration: 800, ease: "Power2", delay: i * 100, onComplete: () => coin.destroy()
      })
    }
    const displayScore = score || 100
    const scoreText = scene.add.text(x, y - 20, "+" + displayScore, {
      fontSize: "16px", fontFamily: "'Press Start 2P', Arial", color: "#ffc847", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4
    }).setOrigin(0.5).setDepth(21)
    scene.tweens.add({ targets: scoreText, y: y - 70, alpha: 0, duration: 1000, ease: "Power1", onComplete: () => scoreText.destroy() })
  }

  /** 清理选择面板 */
  api.destroyChoicePanel = () => { destroyChoicePanel(scene); hideSpellInput(scene) }

  /** 提交拼写答案 */
  api.submitSpell = (inputText) => handleSpellSubmit(scene, api, inputText)

  /** 取消拼写 */
  api.cancelSpell = () => hideSpellInput(scene)

  /** 检查是否拼写模式 */
  api.isSpellMode = () => scene.targetLocked && scene.lockedTarget?.qType === 'spell_hint'

  return api
}

// ─── 内部函数 ───

function createChoicePanel(scene, displayText, options, qType) {
  const { width, height } = scene.cameras.main
  const isCn2En = qType === 'choice_cn2en'
  scene._choiceWordText = scene.add.text(width / 2, height - 115, displayText, {
    fontSize: isCn2En ? '20px' : '26px',
    fontFamily: isCn2En ? 'Microsoft YaHei' : '"Press Start 2P", monospace',
    color: '#ffd700', fontStyle: 'bold',
    stroke: '#000', strokeThickness: 4
  }).setOrigin(0.5).setDepth(300).setScrollFactor(0)

  scene._choiceOpts = []
  const btnW = 200, btnH = 36, gap = 10, totalW = btnW * 4 + gap * 3
  const startX = width / 2 - totalW / 2 + btnW / 2
  const optFontSize = isCn2En ? '11px' : '13px'
  const optFontFamily = isCn2En ? '"Press Start 2P", monospace' : 'Microsoft YaHei'
  for (let i = 0; i < 4; i++) {
    const x = startX + i * (btnW + gap), y = height - 55
    const bg = scene.add.graphics().setDepth(300).setScrollFactor(0)
    bg.fillStyle(0x2d5016, 0.85)
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6)
    bg.lineStyle(2, 0x8b6914)
    bg.strokeRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 6)
    const label = scene.add.text(x, y, `[${i + 1}] ${options[i]}`, {
      fontSize: optFontSize, fontFamily: optFontFamily, color: '#f5edd6'
    }).setOrigin(0.5).setDepth(301).setScrollFactor(0)
    scene._choiceOpts.push({ bg, label, x, y })
  }

  const hint = isCn2En ? '选择正确英文单词 · 1-4 数字键 · Esc取消' : '选择正确中文释义 · 1-4 数字键 · Esc取消'
  scene._choiceHint = scene.add.text(width / 2, height - 130, hint, {
    fontSize: '11px', fontFamily: 'Microsoft YaHei', color: '#c4b99a'
  }).setOrigin(0.5).setDepth(300).setScrollFactor(0)
}

function destroyChoicePanel(scene) {
  if (scene._choiceWordText) { scene._choiceWordText.destroy(); scene._choiceWordText = null }
  if (scene._choiceOpts) { scene._choiceOpts.forEach(o => { o.bg.destroy(); o.label.destroy() }); scene._choiceOpts = null }
  if (scene._choiceHint) { scene._choiceHint.destroy(); scene._choiceHint = null }
}

// ─── 拼写输入 DOM 管理 ───

function showSpellInput(scene, word) {
  hideSpellInput(scene) // 清理旧的

  const { width, height } = scene.cameras.main
  const canvas = scene.game.canvas
  const canvasRect = canvas.getBoundingClientRect()
  const scaleX = canvasRect.width / width
  const scaleY = canvasRect.height / height

  // 提示文字（Canvas）
  scene._choiceWordText = scene.add.text(width / 2, height - 130, `拼写: ${word.word}`, {
    fontSize: '20px', fontFamily: '"Press Start 2P", monospace',
    color: '#ffd700', stroke: '#000', strokeThickness: 4
  }).setOrigin(0.5).setDepth(300).setScrollFactor(0)

  scene._choiceHint = scene.add.text(width / 2, height - 105, '输入英文单词 · Enter提交 · Esc取消', {
    fontSize: '11px', fontFamily: 'Microsoft YaHei', color: '#c4b99a'
  }).setOrigin(0.5).setDepth(300).setScrollFactor(0)

  // DOM 输入框
  const input = document.createElement('input')
  input.type = 'text'
  input.id = 'wordquest-spell-input'
  input.style.cssText = `
    position: fixed; left: ${canvasRect.left + canvasRect.width / 2 - 150}px;
    top: ${canvasRect.top + canvasRect.height * 0.75}px;
    width: 300px; height: 40px; font-size: 20px; text-align: center;
    font-family: 'Press Start 2P', monospace; background: rgba(45,80,22,0.9);
    color: #ffd700; border: 2px solid #8b6914; border-radius: 6px;
    z-index: 9999; outline: none;
  `
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('spellcheck', 'false')
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSpellSubmit(scene, input.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      hideSpellInput(scene)
      scene._combat?.cancelLock()
    }
  })
  document.body.appendChild(input)
  setTimeout(() => input.focus(), 50)
  scene._spellInput = input
}

function hideSpellInput(scene) {
  if (scene._spellInput) {
    scene._spellInput.remove()
    scene._spellInput = null
  }
}

function handleSpellSubmit(scene, inputText) {
  const combat = scene._combat
  if (!combat || !scene.targetLocked || !scene.lockedTarget) return
  const correctWord = scene.lockedTarget.correctAnswer || scene.lockedTarget.word?.word
  if (!correctWord) return

  const result = evaluateSpellingAnswer(inputText.trim(), correctWord)
  hideSpellInput(scene)

  if (result.isCorrect) {
    levelManager.correctCount++
    audioManager.play('correct')
    const wasLast = Object.keys(scene.monsterAIs || {}).length === 1
    let bonusGold = 0
    if (scene.weaponId === 'sword') levelManager.score += 20
    if (scene.weaponId === 'hammer' && Math.random() < 0.5) bonusGold = 100
    if (scene.weaponId === 'staff' && Math.random() < 0.3) {
      combat.freezeRandomMonster(scene.lockedTarget.idx)
    }
    combat.killMonster(scene.lockedTarget.idx, bonusGold)
    if (!wasLast) combat.cancelLock()
  } else {
    levelManager.wrongCount++
    audioManager.play('wrong')
    const { width, height } = scene.cameras.main
    const feedback = scene.add.text(width / 2, height - 60, `✗ 正确答案: ${correctWord}`, {
      fontSize: '14px', fontFamily: 'Microsoft YaHei', color: '#ff4444',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(302).setScrollFactor(0)
    scene._flashTimer = window.setTimeout(() => {
      if (feedback.active) feedback.destroy()
      scene._flashTimer = null
      combat.cancelLock()
    }, 800)
  }
}
