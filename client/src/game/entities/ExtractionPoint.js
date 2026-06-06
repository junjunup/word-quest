import Phaser from 'phaser'

/** 撤离点 — 走近按E撤离结算 */
export default class ExtractionPoint {
  constructor(scene, x, y) {
    this.scene = scene
    this.used = false

    // Visual: glowing portal
    this.graphics = scene.add.graphics().setDepth(4)
    this.graphics.fillStyle(0x4488ff, 0.3)
    this.graphics.fillCircle(x, y, 40)
    this.graphics.lineStyle(3, 0x88bbff, 0.8)
    this.graphics.strokeCircle(x, y, 40)
    this.graphics.lineStyle(2, 0xaaddff, 0.5)
    this.graphics.strokeCircle(x, y, 30)

    this.label = scene.add.text(x, y, '🚪 撤离点', { fontSize: '14px', fontFamily: 'Microsoft YaHei', color: '#aaddff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(5)

    // Pulsing
    scene.tweens.add({ targets: this.label, alpha: { from: 0.6, to: 1 }, duration: 1000, yoyo: true, repeat: -1 })
    scene.tweens.add({ targets: this.graphics, alpha: { from: 0.5, to: 1 }, duration: 1200, yoyo: true, repeat: -1 })
  }

  isPlayerNear(player) {
    if (this.used) return false
    return Phaser.Math.Distance.Between(player.x, player.y, this.label.x, this.label.y) < 50
  }

  triggerExtraction() {
    this.used = true
    this.label.setText('✅ 撤离中...')
  }

  destroy() {
    if (this.graphics) this.graphics.destroy()
    if (this.label) this.label.destroy()
  }
}
