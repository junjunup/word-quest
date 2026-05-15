import { readdirSync, statSync } from 'fs'
import { join } from 'path'

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets')
const KB = 1024

const budgets = [
  { name: 'Dashboard route JS', pattern: /^DashboardView-.*\.js$/, maxKb: 120 },
  { name: 'Game route JS shell', pattern: /^GameView-.*\.js$/, maxKb: 180 },
  { name: 'Social route JS', pattern: /^SocialView-.*\.js$/, maxKb: 120 },
  { name: 'Profile route JS', pattern: /^ProfileView-.*\.js$/, maxKb: 80 },
  { name: 'Review modal JS', pattern: /^ReviewMode-.*\.js$/, maxKb: 80 },
  { name: 'Chart vendor lazy chunk', pattern: /^chart-vendor-.*\.js$/, maxKb: 1100 },
  { name: 'Phaser lazy chunk', pattern: /^phaser-.*\.js$/, maxKb: 1600 },
  { name: 'Vue vendor chunk', pattern: /^vue-vendor-.*\.js$/, maxKb: 140 }
]

function listAssets() {
  return readdirSync(ASSETS_DIR).map(file => {
    const sizeKb = statSync(join(ASSETS_DIR, file)).size / KB
    return { file, sizeKb }
  })
}

const assets = listAssets()
const failures = []
const report = []

for (const budget of budgets) {
  const matches = assets.filter(asset => budget.pattern.test(asset.file))
  if (matches.length === 0) {
    failures.push(`${budget.name}: missing matching bundle`)
    continue
  }
  for (const asset of matches) {
    const line = `${budget.name}: ${asset.file} ${asset.sizeKb.toFixed(1)}KB / ${budget.maxKb}KB`
    report.push(line)
    if (asset.sizeKb > budget.maxKb) failures.push(line)
  }
}

console.log('Bundle budget report:')
report.forEach(line => console.log(`- ${line}`))

if (failures.length > 0) {
  console.error('\nBundle budget exceeded:')
  failures.forEach(line => console.error(`- ${line}`))
  process.exit(1)
}

console.log('\nBundle budget PASS')
