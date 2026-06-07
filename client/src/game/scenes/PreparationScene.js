import Phaser from 'phaser'
import inventory, { DEFAULT_ARMORS } from '../systems/Inventory'
import audioManager from '../systems/AudioManager'
import { DIFFICULTY_CONFIGS } from '../config/gameConstants'

const W = 960
const H = 640

const BLESSINGS = [
  { id: 'health', name: 'Vitality', icon: '❤️', desc: '+2 Max HP', effect: 'healthBoost' },
  { id: 'wealth', name: 'Wealth',   icon: '💰', desc: 'Gold x1.5', effect: 'wealthBoost' },
  { id: 'guard',  name: 'Guardian', icon: '🛡️', desc: 'First hit free', effect: 'firstHitFree' }
]

export default class PreparationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreparationScene' })
  }

  init(data) {
    this.chapter = data?.chapter || 1
    this.level = data?.level || 1
    this.difficulty = data?.difficulty || 'normal'
    this.selectedWeapon = inventory.getEquippedWeapon()
    this.selectedArmor = inventory.getEquippedArmor()
    this.selectedBlessing = null
    this._confirmBuy = null
    this._panelObjects = []
  }

  create() {
    this.cameras.main.setBackgroundColor('#3a6b1e')
    this.input.enabled = true

    ;['WorldScene', 'ResultScene'].forEach(key => {
      const s = this.game.scene.getScene(key)
      if (s && s.scene.isActive()) s.scene.stop()
    })

    audioManager.init(this)
    audioManager.stopBGM(0)
    audioManager.playBGM('bgm_menu')

    this._createBackground()
    this._createTopBar()
    this._buildPanels()
    this._createBottomButtons()

    this.events.once('shutdown', this._shutdown, this)
  }

  _createBackground() {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x3a6b1e, 0x2d5016, 0x2d5016, 0x3a6b1e, 1)
    bg.fillRect(0, 0, W, H)
    for (let i = 0; i < 25; i++) {
      this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H),
        Phaser.Math.Between(2, 4), Phaser.Math.Between(0, 1) ? 0xffc847 : 0x99cc66
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.35))
    }
  }

  _createTopBar() {
    const bar = this.add.graphics()
    bar.fillStyle(0x000000, 0.45)
    bar.fillRect(0, 0, W, 48)
    bar.lineStyle(1, 0x8b6914, 0.6)
    bar.lineBetween(0, 48, W, 48)

    const diff = DIFFICULTY_CONFIGS[this.difficulty] || {}
    this.add.text(20, 14, '⚔️ PREPARE', {
      fontSize: '18px', fontFamily: '"Press Start 2P", Microsoft YaHei',
      color: '#ffc847', stroke: '#5b3a1a', strokeThickness: 3
    })
    this.add.text(W / 2, 16, `Ch.${this.chapter} · Lv.${this.level}`, {
      fontSize: '13px', fontFamily: '"Press Start 2P", monospace',
      color: '#f5edd6', stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5, 0)
    this.add.text(W / 2 + 180, 16, `${diff.icon || '⚔️'} ${diff.label || 'Normal'}`, {
      fontSize: '11px', fontFamily: 'Microsoft YaHei',
      color: '#c4b99a', stroke: '#000', strokeThickness: 1
    })
    this._goldText = this.add.text(W - 20, 14, `🪙 ${inventory.getGold()}`, {
      fontSize: '14px', fontFamily: '"Press Start 2P", monospace',
      color: '#ffd700', stroke: '#000', strokeThickness: 2
    }).setOrigin(1, 0)
  }

  _refreshGold() {
    if (this._goldText) this._goldText.setText(`🪙 ${inventory.getGold()}`)
  }

  _buildPanels() {
    this._panelObjects = []
    this._createWeaponPanel()
    this._createArmorPanel()
    this._createBlessingPanel()
  }

  _rebuildPanels() {
    this._panelObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy() })
    this._panelObjects = []
    this._buildPanels()
  }

  _track(obj) {
    if (obj) this._panelObjects.push(obj)
    return obj
  }

  _createWeaponPanel() {
    const colX = 30, colW = 280, startY = 70, cardH = 72, gap = 7
    const weapons = inventory.getWeapons()

    this._track(this.add.text(colX + colW / 2, startY - 16, '— Weapon —', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei',
      color: '#ffc847', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0))

    weapons.forEach((w, i) => {
      const y = startY + i * (cardH + gap)
      this._createCard(colX, y, colW, cardH, {
        icon: w.icon, title: w.name, subtitle: w.desc,
        owned: w.owned, selected: this.selectedWeapon === w.id,
        locked: !w.owned && w.unlockLevel && this.level < w.unlockLevel,
        lockText: w.unlockLevel ? `🔒 Lv.${w.unlockLevel}` : '🔒 Locked',
        price: w.price,
        onSelect: () => this._onWeaponSelect(w)
      })
    })
  }

  _createArmorPanel() {
    const colX = 340, colW = 260, startY = 70, cardH = 82, gap = 7
    const armors = inventory.getArmors()

    this._track(this.add.text(colX + colW / 2, startY - 16, '— Armor —', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei',
      color: '#ffc847', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0))

    armors.forEach((a, i) => {
      const y = startY + i * (cardH + gap)
      const fullDef = DEFAULT_ARMORS.find(d => d.id === a.id) || a
      this._createCard(colX, y, colW, cardH, {
        icon: a.icon, title: a.name, subtitle: `HP +${fullDef.hpBonus}`,
        owned: a.owned, selected: this.selectedArmor === a.id,
        locked: false, price: a.price || fullDef.price || 0,
        onSelect: () => this._onArmorSelect(a)
      })
    })
  }

  _createBlessingPanel() {
    const colX = 630, colW = 300, startY = 70, cardH = 72, gap = 7

    this._track(this.add.text(colX + colW / 2, startY - 16, '— Blessing —', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei',
      color: '#66ccff', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0))

    BLESSINGS.forEach((b, i) => {
      const y = startY + i * (cardH + gap)
      this._createCard(colX, y, colW, cardH, {
        icon: b.icon, title: b.name, subtitle: b.desc,
        owned: true, selected: this.selectedBlessing === b.id,
        locked: false, onSelect: () => this._onBlessingSelect(b)
      })
    })

    this._track(this.add.text(colX + colW / 2, startY + 3 * (cardH + gap) + 10,
      'Choose one blessing', {
        fontSize: '10px', fontFamily: 'Microsoft YaHei', color: '#8899aa'
      }).setOrigin(0.5, 0))
  }

  _createCard(x, y, w, h, cfg) {
    const bg = this._track(this.add.graphics())
    const drawBg = () => {
      bg.clear()
      if (cfg.selected) {
        bg.fillStyle(0x5b8c3e, 0.7); bg.fillRoundedRect(x, y, w, h, 6)
        bg.lineStyle(2.5, 0xffc847, 1); bg.strokeRoundedRect(x, y, w, h, 6)
      } else if (!cfg.owned && cfg.price > 0) {
        bg.fillStyle(0x3a3a3a, 0.6); bg.fillRoundedRect(x, y, w, h, 6)
        bg.lineStyle(1.5, 0x666666, 1); bg.strokeRoundedRect(x, y, w, h, 6)
      } else if (cfg.locked) {
        bg.fillStyle(0x2a2a2a, 0.5); bg.fillRoundedRect(x, y, w, h, 6)
        bg.lineStyle(1, 0x444444, 1); bg.strokeRoundedRect(x, y, w, h, 6)
      } else {
        bg.fillStyle(0x2d5016, 0.55); bg.fillRoundedRect(x, y, w, h, 6)
        bg.lineStyle(1.5, 0x5b8c3e, 0.8); bg.strokeRoundedRect(x, y, w, h, 6)
      }
    }
    drawBg()

    const textColor = cfg.locked ? '#666' : (!cfg.owned ? '#999' : '#f5edd6')
    const subColor  = cfg.locked ? '#555' : (!cfg.owned ? '#777' : '#c4b99a')

    this._track(this.add.text(x + 12, y + 10, cfg.icon, { fontSize: '20px' }))
    this._track(this.add.text(x + 42, y + 10, cfg.title, {
      fontSize: '14px', fontFamily: 'Microsoft YaHei', color: textColor,
      fontStyle: 'bold', stroke: '#000', strokeThickness: 1
    }))
    this._track(this.add.text(x + 42, y + 32, cfg.subtitle, {
      fontSize: '11px', fontFamily: 'Microsoft YaHei', color: subColor
    }))

    let statusStr = ''
    let statusColor = '#7eb55e'
    if (cfg.selected)           { statusStr = '✅ Selected'; statusColor = '#ffc847' }
    else if (cfg.locked)        { statusStr = cfg.lockText; statusColor = '#666' }
    else if (!cfg.owned && cfg.price > 0) { statusStr = `💰${cfg.price}`; statusColor = '#e8a33c' }
    else if (cfg.owned)         { statusStr = '✓ Owned'; statusColor = '#7eb55e' }

    if (statusStr) {
      this._track(this.add.text(x + w - 12, y + h - 12, statusStr, {
        fontSize: '10px', fontFamily: 'Microsoft YaHei', color: statusColor,
        stroke: '#000', strokeThickness: 1
      }).setOrigin(1, 0))
    }

    const hit = this._track(this.add.rectangle(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001))

    hit.on('pointerover', () => {
      if (!cfg.locked) {
        bg.clear()
        bg.fillStyle(0x4a7c2e, 0.75); bg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 7)
        bg.lineStyle(2, 0xffc847, 0.6); bg.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 7)
      }
    })
    hit.on('pointerout', () => drawBg())
    hit.on('pointerdown', () => {
      if (cfg.locked) {
        this._showToast(`${cfg.title} unlocks at Lv.${cfg.unlockLevel || '?'}`); return
      }
      audioManager.play('click')
      cfg.onSelect()
    })
  }

  _onWeaponSelect(weapon) {
    if (!weapon.owned) {
      if (weapon.price && inventory.getGold() >= weapon.price) {
        this._showBuyConfirm(weapon, 'weapon')
      } else { this._showToast('Not enough gold!') }
      return
    }
    this.selectedWeapon = weapon.id
    inventory.setEquippedWeapon(weapon.id)
    this._rebuildPanels()
  }

  _onArmorSelect(armor) {
    if (!armor.owned) {
      const price = armor.price || (DEFAULT_ARMORS.find(a => a.id === armor.id) || {}).price || 0
      if (price > 0 && inventory.getGold() >= price) {
        this._showBuyConfirm(armor, 'armor')
      } else { this._showToast('Not enough gold!') }
      return
    }
    this.selectedArmor = armor.id
    inventory.setEquippedArmor(armor.id)
    this._rebuildPanels()
  }

  _onBlessingSelect(blessing) {
    this.selectedBlessing = this.selectedBlessing === blessing.id ? null : blessing.id
    this._rebuildPanels()
  }

  _showBuyConfirm(item, type) {
    if (this._confirmBuy) this._dismissBuyConfirm()
    const price = item.price || 0
    const depth = 400

    const overlay = this.add.graphics().setDepth(depth)
    overlay.fillStyle(0x000000, 0.6); overlay.fillRect(0, 0, W, H)

    const bw = 320, bh = 130, bx = (W - bw) / 2, by = (H - bh) / 2
    const box = this.add.graphics().setDepth(depth + 1)
    box.fillStyle(0x2d5016, 0.95); box.fillRoundedRect(bx, by, bw, bh, 10)
    box.lineStyle(2, 0xffc847, 1); box.strokeRoundedRect(bx, by, bw, bh, 10)

    const objs = [overlay, box]
    const t = (x, y, str, style) => {
      const txt = this.add.text(x, y, str, style).setDepth(depth + 2); objs.push(txt); return txt
    }
    const bt = (x, y, w, h) => {
      const r = this.add.rectangle(x, y, w, h).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(depth + 4)
      objs.push(r); return r
    }
    const bg = () => {
      const g = this.add.graphics().setDepth(depth + 2); objs.push(g); return g
    }

    t(W / 2, by + 18, `Buy ${item.icon} ${item.name}?`, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei', color: '#ffc847',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0)

    t(W / 2, by + 48, `Cost 🪙 ${price}  |  Balance 🪙 ${inventory.getGold()}`, {
      fontSize: '12px', fontFamily: 'Microsoft YaHei', color: '#f5edd6',
      stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5, 0)

    const cbx = W / 2 - 70, cby = by + 80, cbw = 110, cbh = 34
    const cbg = bg()
    cbg.fillStyle(0x5b8c3e, 1); cbg.fillRoundedRect(cbx, cby, cbw, cbh, 5)
    cbg.lineStyle(2, 0x3a6b1e); cbg.strokeRoundedRect(cbx, cby, cbw, cbh, 5)
    t(W / 2 - 15, cby + cbh / 2, 'Confirm', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei', color: '#f5edd6', fontStyle: 'bold'
    }).setOrigin(0.5)

    bt(W / 2 - 15, cby + cbh / 2, cbw, cbh).on('pointerdown', () => {
      const success = type === 'weapon'
        ? inventory.buyWeapon(item.id, price)
        : inventory.buyArmor(item.id, price)
      if (success) {
        audioManager.play('coin')
        if (type === 'weapon') { this.selectedWeapon = item.id; inventory.setEquippedWeapon(item.id) }
        else { this.selectedArmor = item.id; inventory.setEquippedArmor(item.id) }
        this._showToast(`Bought ${item.name}!`)
      }
      this._dismissBuyConfirm()
      this._rebuildPanels()
      this._refreshGold()
    })

    t(W / 2 + 75, cby + cbh / 2, 'Cancel', {
      fontSize: '12px', fontFamily: 'Microsoft YaHei', color: '#999', fontStyle: 'bold'
    }).setOrigin(0.5)
    bt(W / 2 + 75, cby + cbh / 2, 80, cbh).on('pointerdown', () => this._dismissBuyConfirm())

    const dz = this.add.rectangle(W / 2, H / 2, W, H).setInteractive().setAlpha(0.001).setDepth(depth - 1)
    dz.on('pointerdown', () => this._dismissBuyConfirm())
    objs.push(dz)

    this._confirmBuy = objs
  }

  _dismissBuyConfirm() {
    if (!this._confirmBuy) return
    this._confirmBuy.forEach(obj => { if (obj && obj.destroy) obj.destroy() })
    this._confirmBuy = null
  }

  _showToast(message) {
    const toast = this.add.text(W / 2, H - 100, message, {
      fontSize: '14px', fontFamily: 'Microsoft YaHei', color: '#ffc847',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
      backgroundColor: '#2d5016cc', padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(500)
    this.tweens.add({
      targets: toast, alpha: 0, y: toast.y - 40, duration: 1500, delay: 800,
      onComplete: () => toast.destroy()
    })
  }

  _createBottomButtons() {
    const by = H - 55
    this._createWoodButton(230, by, 'Skip', 0x666666, 0x444444, () => {
      this.selectedWeapon = inventory.getEquippedWeapon()
      this.selectedArmor = inventory.getEquippedArmor()
      this.selectedBlessing = null
      this._startAdventure()
    })
    this._createWoodButton(W - 230, by, '⚔️ Start', 0x5b8c3e, 0x3a6b1e, () => {
      inventory.setEquippedWeapon(this.selectedWeapon)
      inventory.setEquippedArmor(this.selectedArmor)
      this._startAdventure()
    })
  }

  _createWoodButton(x, y, text, fillColor, strokeColor, callback) {
    const btnW = 200, btnH = 42
    const bg = this.add.graphics().setDepth(200)
    const draw = (hover) => {
      bg.clear()
      const w = hover ? btnW + 6 : btnW, h = hover ? btnH + 4 : btnH
      const ox = x - w / 2, oy = y - h / 2
      bg.fillStyle(fillColor, hover ? 0.9 : 1); bg.fillRoundedRect(ox, oy, w, h, 4)
      bg.lineStyle(2, hover ? 0xffc847 : strokeColor); bg.strokeRoundedRect(ox, oy, w, h, 4)
      if (!hover) { bg.lineStyle(1, 0xffffff, 0.1); bg.lineBetween(ox + 6, oy + 2, ox + w - 6, oy + 2) }
    }
    draw(false)
    const label = this.add.text(x, y, text, {
      fontSize: '15px', fontFamily: 'Microsoft YaHei', color: '#f5edd6',
      fontStyle: 'bold', stroke: '#000', strokeThickness: 1
    }).setOrigin(0.5).setDepth(201)
    const hit = this.add.rectangle(x, y, btnW, btnH)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(202)
    hit.on('pointerover', () => { draw(true); label.setScale(1.03) })
    hit.on('pointerout', () => { draw(false); label.setScale(1) })
    hit.on('pointerdown', () => { audioManager.play('click'); callback() })
  }

  _startAdventure() {
    this.input.enabled = false
    this.tweens.killAll()
    this.cameras.main.fadeOut(400, 0x2d5016, 0x2d5016, 0x2d5016)
    const data = {
      chapter: this.chapter, level: this.level, difficulty: this.difficulty,
      weaponId: this.selectedWeapon, armorId: this.selectedArmor,
      blessingId: this.selectedBlessing
    }
    const game = this.game
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const rs = game.scene.getScene('ResultScene')
      if (rs) { rs.children.removeAll(true); rs.tweens.killAll(); if (rs.scene.isActive()) rs.scene.stop() }
      // 强制 stop WorldScene（SceneManager.stop 对 sleeping 也有效，ScenePlugin.stop 是 no-op）
      const ws = game.scene.getScene('WorldScene')
      if (ws && (ws.scene.isActive() || ws.scene.isSleeping())) game.scene.stop('WorldScene')
      window.setTimeout(() => game.scene.start('WorldScene', data), 0)
    })
  }

  _shutdown() {
    this._dismissBuyConfirm()
    this._panelObjects.forEach(obj => { if (obj && obj.destroy) obj.destroy() })
    this._panelObjects = []
    this.tweens.killAll()
    this.input.enabled = false
    if (this.input.keyboard) { this.input.keyboard.off('keydown'); this.input.keyboard.off('keyup') }
    this.children.removeAll(true)
  }
}
