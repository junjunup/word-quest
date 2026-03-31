# 明天继续开发指南

## 快速恢复命令
```bash
cd D:/CLAW/sxh-game/ai-gamified-learning
```

## 当前状态
- ✅ 72个源文件全部创建完成
- ✅ npm依赖已安装 (client + server)
- ✅ 客户端构建测试通过
- ❌ **唯一缺失: `server/src/data/vocabulary.json` (400词词库)**

## 明天第一步: 创建词库

请执行以下指令:
```
创建文件 server/src/data/vocabulary.json，包含400个英语单词的JSON数组。
每个单词对象包含: word, phonetic, meaning, partOfSpeech, example, exampleTranslation, difficulty(1-5), chapter(1-6), level(1-5), synonyms[], antonyms[], rootAnalysis, memoryTip, category

分布要求:
- Chapter 1 (基础日常): 80词, Level 1-5各16词, 分类food/body/family/time/colors
- Chapter 2 (自然动物): 70词, Level 1-5各14词, 分类animals/plants/weather/geography/ocean
- Chapter 3 (商业社交): 70词, Level 1-5各14词, 分类shopping/business/social/restaurant/travel
- Chapter 4 (学术科技): 70词, Level 1-5各14词, 分类education/science/technology/medical/academic
- Chapter 5 (易混词): 50词, Level 1-5各10词, 分类confusing_pairs
- Chapter 6 (综合复习): 60词, Level 1-5各12词, 分类review_mixed
```

## 明天第二步: 联调测试

```bash
# 1. 启动MongoDB (确保本地MongoDB运行在27017端口)
# 2. 导入词库
cd server && npm run seed

# 3. 三个终端分别启动
cd server && npm run dev          # 后端 :4000
cd llm-service && python main.py  # LLM :8000
cd client && npm run dev          # 前端 :3000

# 4. 打开 http://localhost:3000 测试完整流程
```

## 明天第三步 (可选优化)
1. GameView.vue 的 onShowQuiz 方法改为调用真实API获取题目
2. 添加游戏音效素材
3. 替换占位精灵图为像素风素材
4. 完善Docker部署配置

## 文件结构参考
详见 PROGRESS.md 中的完整文件清单
