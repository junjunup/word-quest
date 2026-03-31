import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import MenuScene from './scenes/MenuScene'
import WorldScene from './scenes/WorldScene'
import ResultScene from './scenes/ResultScene'

/**
 * Phaser 游戏配置
 * 将嵌入Vue的GameView组件中
 */
export function createGameConfig(parentElement) {
  return {
    type: Phaser.AUTO,
    parent: parentElement,
    width: 960,
    height: 640,
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, WorldScene, ResultScene]
  }
}
