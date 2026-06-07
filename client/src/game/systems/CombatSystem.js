/**
 * CombatSystem — 战术暂停战斗
 * 提取自 WorldScene：锁定目标、选择面板、击杀、浮字、金币特效
 */
import Phaser from 'phaser'
import audioManager from './AudioManager'
import levelManager from './LevelManager'
import eventBus, { EVENTS } from './EventBus'
import inventory from './Inventory'

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

    // 随机题型：50% 英→中, 50% 中→英
    const qType = Math.random() < 0.5 ? 'choice_en2cn' : 'choice_cn2en'
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
    const correctIdx = options.indexOf(correct) + 1

    scene.targetLocked = true
    scene.lockedTarget = { ...closest, word, options, correctIdx, qType }
    scene.timeScale = 0.2
    scene.isPaused = true
    audioManager.pauseBGM(200)

    const promptText = qType === 'choice_en2cn' ? word.word : word.meaning
    scene.monsterLabels?.[closest.idx]?.setText(promptText)

    createChoicePanel(scene, promptText, options, qType)
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
  api.destroyChoicePanel = () => destroyChoicePanel(scene)

  /** 检查是否有活跃战斗 */
  api.isActive = () => scene.targetLocked

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
