import Phaser from 'phaser'
import audioManager from '../systems/AudioManager'

/** 宝箱 — 走近按E打开获得金币 */
export default class Chest {
  constructor(scene, x, y, goldAmount = 50) {
    this.scene = scene
    this.goldAmount = goldAmount
    this.opened = false

    // Visual: simple chest sprite or rectangle
    this.sprite = scene.add.sprite(x, y, 'coin').setScale(3).setDepth(4)
    scene.tweens.add({ targets: this.sprite, y: y - 4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    this.label = scene.add.text(x, y - 24, '📦', { fontSize: '20px' }).setOrigin(0.5).setDepth(5)

    // Interaction zone
    this.zone = scene.add.zone(x, y, 60, 60).setDepth(1)
    scene.physics.add.existing(this.zone, true) // static body
  }

  /** 检查玩家是否在交互范围内 */
  isPlayerNear(player) {
    if (this.opened) return false
    return Phaser.Math.Distance.Between(player.x, player.y, this.sprite.x, this.sprite.y) < 50
  }

  /** 打开宝箱 */
  open(inventory) {
    if (this.opened) return 0
    this.opened = true
    audioManager.play('coin')
    this.label.setText('✅')
    this.scene.tweens.add({ targets: [this.sprite, this.label], alpha: 0, duration: 500, onComplete: () => { this.sprite.destroy(); this.label.destroy() } })
    inventory.addGold(this.goldAmount)
    return this.goldAmount
  }

  destroy() {
    if (this.sprite) this.sprite.destroy()
    if (this.label) this.label.destroy()
    if (this.zone) this.zone.destroy()
  }
}
