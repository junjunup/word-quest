/**
 * 词库导入脚本
 * 运行: npm run seed
 */
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 导入模型
import VocabularyBank from './models/VocabularyBank.js'
import User from './models/User.js'
import GameProgress from './models/GameProgress.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/word-quest'

async function seed() {
  try {
    console.log('正在连接数据库...')
    await mongoose.connect(MONGODB_URI)
    console.log('数据库连接成功！')

    // 清空现有词库
    await VocabularyBank.deleteMany({})
    console.log('已清空旧词库数据')

    // 读取词库JSON
    const vocabPath = join(__dirname, 'data', 'vocabulary.json')
    let vocabulary = []

    try {
      const rawData = readFileSync(vocabPath, 'utf-8')
      vocabulary = JSON.parse(rawData)
      console.log(`从文件读取了 ${vocabulary.length} 个词汇`)
    } catch (e) {
      console.log('词库文件不存在，使用内置示例数据...')
      vocabulary = getBuiltinVocabulary()
    }

    // 批量插入
    if (vocabulary.length > 0) {
      await VocabularyBank.insertMany(vocabulary)
      console.log(`成功导入 ${vocabulary.length} 个词汇！`)
    }

    // 统计各章节词汇数
    for (let ch = 1; ch <= 6; ch++) {
      const count = await VocabularyBank.countDocuments({ chapter: ch })
      console.log(`  第${ch}章: ${count} 词`)
    }

    // 创建测试用户
    const existingUser = await User.findOne({ username: 'test' })
    if (!existingUser) {
      const testUser = new User({
        username: 'test',
        password: '123456',
        nickname: '测试勇者'
      })
      await testUser.save()

      // 创建初始游戏进度
      await new GameProgress({ userId: testUser._id }).save()
      console.log('\n已创建测试用户: test / 123456')
    } else {
      console.log('\n测试用户已存在')
    }

    console.log('\n✅ 数据初始化完成！')
  } catch (err) {
    console.error('❌ 数据初始化失败:', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

/**
 * 内置词汇数据（用于没有vocabulary.json时的后备数据）
 */
function getBuiltinVocabulary() {
  const words = []

  // Chapter 1 - 基础日常词汇 (示例部分)
  const ch1Words = [
    { word: 'apple', phonetic: '/ˈæpl/', meaning: '苹果', partOfSpeech: 'n.', example: 'I eat an apple every day.', exampleTranslation: '我每天吃一个苹果。', difficulty: 1, chapter: 1, level: 1, category: 'food', memoryTip: 'apple谐音"啊跑"，苹果掉了啊快跑去捡' },
    { word: 'bread', phonetic: '/bred/', meaning: '面包', partOfSpeech: 'n.', example: 'Would you like some bread?', exampleTranslation: '你想来点面包吗？', difficulty: 1, chapter: 1, level: 1, category: 'food', memoryTip: '面包 = b + read，一边吃面包一边read阅读' },
    { word: 'chicken', phonetic: '/ˈtʃɪkɪn/', meaning: '鸡肉；鸡', partOfSpeech: 'n.', example: 'We had chicken for dinner.', exampleTranslation: '我们晚餐吃了鸡肉。', difficulty: 1, chapter: 1, level: 1, category: 'food', memoryTip: 'chick小鸡 + en' },
    { word: 'delicious', phonetic: '/dɪˈlɪʃəs/', meaning: '美味的', partOfSpeech: 'adj.', example: 'This cake is delicious!', exampleTranslation: '这个蛋糕太好吃了！', difficulty: 2, chapter: 1, level: 1, category: 'food', memoryTip: 'deli（熟食店）+ cious → 熟食店的东西很美味' },
    { word: 'vegetable', phonetic: '/ˈvedʒtəbl/', meaning: '蔬菜', partOfSpeech: 'n.', example: 'Eat more vegetables.', exampleTranslation: '多吃蔬菜。', difficulty: 1, chapter: 1, level: 1, category: 'food', memoryTip: 'veget（生长）+ able → 能生长的东西→蔬菜' },
    { word: 'shoulder', phonetic: '/ˈʃoʊldər/', meaning: '肩膀', partOfSpeech: 'n.', example: 'He put his hand on my shoulder.', exampleTranslation: '他把手放在我肩上。', difficulty: 1, chapter: 1, level: 2, category: 'body', memoryTip: 'should + er → 应该承担的地方→肩膀' },
    { word: 'stomach', phonetic: '/ˈstʌmək/', meaning: '胃；肚子', partOfSpeech: 'n.', example: 'My stomach hurts.', exampleTranslation: '我胃疼。', difficulty: 2, chapter: 1, level: 2, category: 'body', memoryTip: '司徒摸客→摸着肚子的食客' },
    { word: 'daughter', phonetic: '/ˈdɔːtər/', meaning: '女儿', partOfSpeech: 'n.', example: 'She is my daughter.', exampleTranslation: '她是我女儿。', difficulty: 1, chapter: 1, level: 3, category: 'family', memoryTip: 'd + aughter → "到"(d) + "after"(aughter) → 到了之后，家里多了个女儿' },
    { word: 'nephew', phonetic: '/ˈnefjuː/', meaning: '侄子；外甥', partOfSpeech: 'n.', example: 'My nephew is ten years old.', exampleTranslation: '我侄子十岁了。', difficulty: 2, chapter: 1, level: 3, category: 'family', memoryTip: 'ne + phew → "呢"+"呸" → 小侄子淘气说"呸"' },
    { word: 'schedule', phonetic: '/ˈskedʒuːl/', meaning: '时间表；安排', partOfSpeech: 'n.', example: 'What is your schedule today?', exampleTranslation: '你今天的日程安排是什么？', difficulty: 2, chapter: 1, level: 4, category: 'time', memoryTip: 'sche(计划) + dule(规则) → 有计划有规则→时间表' },
    { word: 'purple', phonetic: '/ˈpɜːrpl/', meaning: '紫色的', partOfSpeech: 'adj.', example: 'She wore a purple dress.', exampleTranslation: '她穿了一条紫色的裙子。', difficulty: 1, chapter: 1, level: 5, category: 'colors', memoryTip: '谐音"泼破" → 把紫色的墨水泼破了' },

    // Chapter 2 - 自然与动物
    { word: 'dolphin', phonetic: '/ˈdɒlfɪn/', meaning: '海豚', partOfSpeech: 'n.', example: 'Dolphins are very intelligent animals.', exampleTranslation: '海豚是非常聪明的动物。', difficulty: 2, chapter: 2, level: 1, category: 'animals', memoryTip: 'dol(像doll玩偶) + phin(fin鱼鳍) → 像玩偶一样可爱的有鳍动物' },
    { word: 'blossom', phonetic: '/ˈblɒsəm/', meaning: '花朵；开花', partOfSpeech: 'n./v.', example: 'Cherry blossoms are beautiful in spring.', exampleTranslation: '春天的樱花很美。', difficulty: 2, chapter: 2, level: 2, category: 'plants', memoryTip: 'blow(吹) + some → 风吹来一些花朵' },
    { word: 'thunder', phonetic: '/ˈθʌndər/', meaning: '雷声；打雷', partOfSpeech: 'n./v.', example: 'I heard thunder in the distance.', exampleTranslation: '我听到远处的雷声。', difficulty: 2, chapter: 2, level: 3, category: 'weather', memoryTip: 'thun(谐音"嗵") + der → 嗵的一声→打雷' },

    // Chapter 3 - 商业与社交
    { word: 'negotiate', phonetic: '/nɪˈɡoʊʃieɪt/', meaning: '谈判；协商', partOfSpeech: 'v.', example: 'We need to negotiate the price.', exampleTranslation: '我们需要协商价格。', difficulty: 3, chapter: 3, level: 2, category: 'business', memoryTip: 'neg(否定) + otiate → 双方互相否定→谈判' },
    { word: 'colleague', phonetic: '/ˈkɒliːɡ/', meaning: '同事', partOfSpeech: 'n.', example: 'She is my colleague at work.', exampleTranslation: '她是我的工作同事。', difficulty: 2, chapter: 3, level: 2, category: 'business', memoryTip: 'col(共同) + league(联盟) → 同一个联盟的人→同事' },

    // Chapter 4 - 学术与科技
    { word: 'algorithm', phonetic: '/ˈælɡərɪðəm/', meaning: '算法', partOfSpeech: 'n.', example: 'The search algorithm is very efficient.', exampleTranslation: '这个搜索算法非常高效。', difficulty: 4, chapter: 4, level: 3, category: 'technology', rootAnalysis: '来自数学家al-Khwarizmi的名字', memoryTip: '阿尔(al) + 哥(go) + rhythm(节奏) → 有节奏的计算步骤' },
    { word: 'hypothesis', phonetic: '/haɪˈpɒθəsɪs/', meaning: '假设；假说', partOfSpeech: 'n.', example: 'We need to test this hypothesis.', exampleTranslation: '我们需要验证这个假设。', difficulty: 4, chapter: 4, level: 5, category: 'academic', rootAnalysis: 'hypo-(下面) + thesis(论点) = 放在论点下面的→假设', memoryTip: 'hypo(低于) + thesis(论文) → 低于论文标准的→只是假设' },

    // Chapter 5 - 高频易混词
    { word: 'affect', phonetic: '/əˈfekt/', meaning: 'v. 影响', partOfSpeech: 'v.', example: 'The weather affects my mood.', exampleTranslation: '天气影响我的心情。', difficulty: 3, chapter: 5, level: 1, category: 'look_alike', rootAnalysis: 'af-(朝向) + fect(做) = 对…做→影响', memoryTip: 'affect是动词(A=Action动作)，effect是名词(E=End result结果)' },
    { word: 'effect', phonetic: '/ɪˈfekt/', meaning: 'n. 效果；影响', partOfSpeech: 'n.', example: 'The effect of the medicine is immediate.', exampleTranslation: '这药的效果是立竿见影的。', difficulty: 3, chapter: 5, level: 1, category: 'look_alike', rootAnalysis: 'ef-(出) + fect(做) = 做出来的→效果', memoryTip: 'effect是名词(E=End result)，affect是动词(A=Action)' },

    // Chapter 6 - 综合复习
    { word: 'accomplish', phonetic: '/əˈkɒmplɪʃ/', meaning: '完成；实现', partOfSpeech: 'v.', example: 'She accomplished her goal.', exampleTranslation: '她完成了目标。', difficulty: 3, chapter: 6, level: 4, category: 'review_all', rootAnalysis: 'ac-(加强) + com-(完全) + plish(完成)', memoryTip: 'a + complete + ish → 完全地完成→实现目标' },
  ]

  return ch1Words
}

seed()
