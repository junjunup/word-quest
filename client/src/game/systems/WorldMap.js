/**
 * WorldMap — 地图生成系统
 * 提取自 WorldScene，负责瓦片、围栏、装饰物、树的创建
 */
import Phaser from 'phaser'
import { CHAPTER_THEMES } from '../config/gameConstants'
import { failedAssetKeys } from '../scenes/BootScene'

/** 树帧定义：每棵树由 3列×2行 的 16x16 帧拼成 */
const TREE_FRAMES = {
  green: { topRow: [0, 1, 2], bottomRow: [9, 10, 11] },
  pink:  { topRow: [3, 4, 5], bottomRow: [12, 13, 14] }
}

/**
 * 在 scene 上生成完整的田园地图
 * @param {Phaser.Scene} scene
 * @param {object} config — { chapter }
 */
export function generatePastoralMap(scene, config = {}) {
  const chapter = config.chapter || 1
  const mapWidth = 40
  const mapHeight = 30
  const tileSize = 32
  const theme = CHAPTER_THEMES[chapter] || CHAPTER_THEMES[1]

  scene.mapContainer = scene.add.container(0, 0)
  scene.decoContainer = scene.add.container(0, 0).setDepth(2)

  scene.cameras.main.setBackgroundColor(theme.bgColor)

  const isValid = (key) => scene.textures.exists(key) && !failedAssetKeys.has(key)
  const hasGrassTileset = isValid('grass_tileset')
  const hasFenceSheet = isValid('fence_sheet')
  const hasGrassDecor = isValid('grass_decor')

  // Extract grass variants from tileset (once)
  if (hasGrassTileset && !scene.textures.exists('grass_v0')) {
    const grassSource = scene.textures.get('grass_tileset').getSourceImage()
    for (let v = 0; v < 4; v++) {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const ctx = canvas.getContext('2d')
      const sx = 48 + (v % 2) * 16
      const sy = 32 + Math.floor(v / 2) * 16
      ctx.drawImage(grassSource, sx, sy, 16, 16, 0, 0, 16, 16)
      scene.textures.addCanvas(`grass_v${v}`, canvas)
    }
  }

  // Tile grid
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const px = x * tileSize + 16
      const py = y * tileSize + 16
      const isWall = (y === 0 || y === mapHeight - 1 || x === 0 || x === mapWidth - 1)

      if (isWall) {
        if (hasFenceSheet) {
          let fenceFrame = 0
          if (y === 0 && x === 0) fenceFrame = 0
          else if (y === 0 && x === mapWidth - 1) fenceFrame = 2
          else if (y === mapHeight - 1 && x === 0) fenceFrame = 8
          else if (y === mapHeight - 1 && x === mapWidth - 1) fenceFrame = 10
          else if (y === 0 || y === mapHeight - 1) fenceFrame = 1
          else fenceFrame = 4

          const fence = scene.add.image(px, py, 'fence_sheet', fenceFrame).setScale(2)
          scene.mapContainer.add(fence)
        } else {
          const wall = scene.add.image(px, py, 'wall_tile').setScale(2)
          scene.mapContainer.add(wall)
        }
      } else {
        if (hasGrassTileset && scene.textures.exists('grass_v0')) {
          const v = Phaser.Math.Between(0, 3)
          const tile = scene.add.image(px, py, `grass_v${v}`).setScale(2)
          scene.mapContainer.add(tile)
        } else {
          const grassColors = theme.grassColors
          const color = grassColors[Phaser.Math.Between(0, grassColors.length - 1)]
          const tile = scene.add.rectangle(px, py, tileSize, tileSize, color)
          scene.mapContainer.add(tile)
        }
      }
    }
  }

  // Decorations (trees, flowers, mushrooms, stones)
  addDecorations(scene, { mapWidth, mapHeight, tileSize, hasGrassDecor, theme })

  // Physics walls
  scene.walls = scene.physics.add.staticGroup()
  for (let x = 0; x < mapWidth; x++) {
    const wallTop = scene.walls.create(x * tileSize + 16, 16, null)
    wallTop.setSize(tileSize, tileSize).setVisible(false).refreshBody()
    const wallBot = scene.walls.create(x * tileSize + 16, (mapHeight - 1) * tileSize + 16, null)
    wallBot.setSize(tileSize, tileSize).setVisible(false).refreshBody()
  }
  for (let y = 1; y < mapHeight - 1; y++) {
    const wallLeft = scene.walls.create(16, y * tileSize + 16, null)
    wallLeft.setSize(tileSize, tileSize).setVisible(false).refreshBody()
    const wallRight = scene.walls.create((mapWidth - 1) * tileSize + 16, y * tileSize + 16, null)
    wallRight.setSize(tileSize, tileSize).setVisible(false).refreshBody()
  }

  scene.physics.world.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize)
  scene.cameras.main.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize)
}

/** 放置树木、花朵、蘑菇、石头等装饰物 */
function addDecorations(scene, { mapWidth, mapHeight, tileSize, hasGrassDecor, theme }) {
  const padding = 3
  const playerSpawn = { x: 80, y: 300 }
  const npcSpawn = { x: 700, y: 300 }
  const exclusionDist = 120

  // ─── 1. 树（3×2 帧拼接）───
  if (hasGrassDecor && theme.treeTypes && theme.treeCount > 0) {
    const treePositions = []
    const treeExclusionDist = 120

    for (let t = 0; t < theme.treeCount; t++) {
      const treeType = theme.treeTypes[t % theme.treeTypes.length]
      const frames = TREE_FRAMES[treeType]
      if (!frames) continue

      let placed = false
      for (let attempt = 0; attempt < 50; attempt++) {
        const gx = Phaser.Math.Between(padding, mapWidth - padding - 3)
        const gy = Phaser.Math.Between(padding, mapHeight - padding - 2)
        const px = gx * tileSize + 16
        const py = gy * tileSize + 16

        if (Math.hypot(px - playerSpawn.x, py - playerSpawn.y) < exclusionDist) continue
        if (Math.hypot(px - npcSpawn.x, py - npcSpawn.y) < exclusionDist) continue
        if (treePositions.some(p => Math.hypot(p.x - px, p.y - py) < treeExclusionDist)) continue

        const scale = 2
        const frameW = 16
        for (let row = 0; row < 2; row++) {
          const rowFrames = row === 0 ? frames.topRow : frames.bottomRow
          for (let col = 0; col < 3; col++) {
            const fx = px + (col - 1) * frameW * scale
            const fy = py + (row - 0.5) * frameW * scale
            const treePart = scene.add.image(fx, fy, 'grass_decor', rowFrames[col]).setScale(scale)
            treePart.setDepth(3)
            scene.decoContainer.add(treePart)
          }
        }

        treePositions.push({ x: px, y: py })
        placed = true
        break
      }
    }
  }

  // ─── 2. 单帧小装饰（花、蘑菇、石头等）───
  const decoCount = theme.decoCount || 20
  for (let i = 0; i < decoCount; i++) {
    const gx = Phaser.Math.Between(padding, mapWidth - padding - 1)
    const gy = Phaser.Math.Between(padding, mapHeight - padding - 1)
    const px = gx * tileSize + 16
    const py = gy * tileSize + 16

    if (Math.hypot(px - playerSpawn.x, py - playerSpawn.y) < 80) continue
    if (Math.hypot(px - npcSpawn.x, py - npcSpawn.y) < 80) continue

    if (hasGrassDecor && theme.decoFrames && theme.decoFrames.length > 0) {
      const frame = theme.decoFrames[Phaser.Math.Between(0, theme.decoFrames.length - 1)]
      const deco = scene.add.image(px, py, 'grass_decor', frame).setScale(2)
      deco.setAlpha(0.9)
      scene.decoContainer.add(deco)
    } else {
      const decoType = Phaser.Math.Between(0, 3)
      let deco
      switch (decoType) {
        case 0: deco = scene.add.circle(px, py, 4, 0xff9999); break
        case 1: deco = scene.add.circle(px, py, 5, 0xd4a373); break
        case 2: deco = scene.add.circle(px, py, 6, 0x999999); break
        case 3: deco = scene.add.rectangle(px, py, 10, 8, 0x3a6b1e); break
      }
      if (deco) {
        deco.setAlpha(0.7)
        scene.decoContainer.add(deco)
      }
    }
  }
}
