import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import MenuScene from './scenes/MenuScene'
import WorldScene from './scenes/WorldScene'
import ResultScene from './scenes/ResultScene'

/**
 * Phaser 游戏配置
 * 优先 Canvas 模式（兼容性最广），WebGL 作为备选。
 * Windows 部分 GPU 驱动 WebGL 渲染异常（绿屏），Canvas 模式完全避开此问题。
 */
export function createGameConfig(parentElement) {
  return {
    type: Phaser.CANVAS,  // Canvas 优先 — 避免 WebGL 绿屏
    parent: parentElement,
    width: 960,
    height: 640,
    pixelArt: true,
    transparent: false,
    backgroundColor: '#2d5016',
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
    // WebGL 降级处理
    render: {
      antialias: false,
      pixelArt: true,
      roundPixels: true
    },
    callbacks: {
      postBoot: (game) => {
        // 监听 WebGL 上下文丢失 → 自动切换到 Canvas
        const canvas = game.canvas
        if (canvas) {
          canvas.addEventListener('webglcontextlost', (e) => {
            console.warn('WebGL 上下文丢失，游戏将继续在 Canvas 模式运行')
            e.preventDefault()
          })
        }
      }
    },
    scene: [BootScene, MenuScene, WorldScene, ResultScene]
  }
}
