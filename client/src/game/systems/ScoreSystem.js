/**
 * 积分/徽章系统
 */
import eventBus, { EVENTS } from './EventBus'

// 成就定义
const ACHIEVEMENTS = [
  { id: 'first_clear', name: '初入大陆', description: '完成第一个关卡', icon: '🎮' },
  { id: 'perfect_clear', name: '完美通关', description: '某关卡全部答对', icon: '⭐' },
  { id: 'combo_5', name: '连击新星', description: '达成5连击', icon: '🔥' },
  { id: 'combo_10', name: '连击大师', description: '达成10连击', icon: '💥' },
  { id: 'words_50', name: '初学乍练', description: '学习50个单词', icon: '📖' },
  { id: 'words_100', name: '百词斩', description: '学习100个单词', icon: '📚' },
  { id: 'words_200', name: '词汇达人', description: '学习200个单词', icon: '🎓' },
  { id: 'words_400', name: '词汇大师', description: '学习全部400个单词', icon: '👑' },
  { id: 'chapter_1', name: '章节开拓者', description: '完成第一章', icon: '🏠' },
  { id: 'chapter_3', name: '商贸奇才', description: '完成第三章', icon: '💰' },
  { id: 'chapter_6', name: '终极勇者', description: '完成第六章', icon: '🏆' },
  { id: 'speed_demon', name: '闪电答题', description: '3秒内答对一题', icon: '⚡' },
  { id: 'login_3', name: '三天打鱼', description: '连续登录3天', icon: '📅' },
  { id: 'login_7', name: '一周坚持', description: '连续登录7天', icon: '🗓️' },
  { id: 'login_30', name: '持之以恒', description: '连续登录30天', icon: '🌟' },
  { id: 'npc_friend', name: '小智的朋友', description: '与小智对话10次', icon: '🤖' }
]

class ScoreSystem {
  constructor() {
    this.unlockedAchievements = new Set()
  }

  loadAchievements(achievementIds = []) {
    this.unlockedAchievements = new Set(achievementIds)
  }

  /**
   * 检查并触发成就
   */
  checkAchievements(context) {
    const newAchievements = []

    for (const achievement of ACHIEVEMENTS) {
      if (this.unlockedAchievements.has(achievement.id)) continue

      let unlocked = false
      switch (achievement.id) {
        case 'first_clear':
          unlocked = context.levelsCompleted >= 1
          break
        case 'perfect_clear':
          unlocked = context.perfectClears >= 1
          break
        case 'combo_5':
          unlocked = context.maxCombo >= 5
          break
        case 'combo_10':
          unlocked = context.maxCombo >= 10
          break
        case 'words_50':
          unlocked = context.wordsLearned >= 50
          break
        case 'words_100':
          unlocked = context.wordsLearned >= 100
          break
        case 'words_200':
          unlocked = context.wordsLearned >= 200
          break
        case 'words_400':
          unlocked = context.wordsLearned >= 400
          break
        case 'speed_demon':
          unlocked = context.fastestCorrect > 0 && context.fastestCorrect <= 3000
          break
        case 'chapter_1':
          unlocked = context.chaptersCompleted >= 1
          break
        case 'chapter_3':
          unlocked = context.chaptersCompleted >= 3
          break
        case 'chapter_6':
          unlocked = context.chaptersCompleted >= 6
          break
        case 'login_3':
          unlocked = context.loginStreak >= 3
          break
        case 'login_7':
          unlocked = context.loginStreak >= 7
          break
        case 'login_30':
          unlocked = context.loginStreak >= 30
          break
        case 'npc_friend':
          unlocked = context.npcChats >= 10
          break
      }

      if (unlocked) {
        this.unlockedAchievements.add(achievement.id)
        newAchievements.push(achievement)
      }
    }

    // 弹出成就通知
    for (const a of newAchievements) {
      eventBus.emit(EVENTS.SHOW_ACHIEVEMENT, a)
    }

    return newAchievements
  }

  getAchievementList() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.unlockedAchievements.has(a.id)
    }))
  }
}

export { ACHIEVEMENTS }
export default new ScoreSystem()
