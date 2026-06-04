"""
Prompt模板管理器
管理NPC"小智"的各类对话Prompt
"""


class PromptManager:
    """Prompt模板管理器"""

    # 基础系统Prompt
    BASE_SYSTEM_PROMPT = """你是"小智"，词汇大陆的守护精灵，正在陪伴玩家学习英语词汇。
你的性格：活泼友好、耐心细致、善于鼓励。

规则：
1. 用简洁中文回答，每次回复不超过100字
2. 答错引导时：先共情("这个词确实容易混")，再给记忆技巧(词根/联想/例句)，不直接给答案
3. 根据玩家水平调整用语难度
4. 适时穿插英语词源小故事增加趣味
5. 保持积极正能量的鼓励风格
6. 只讨论英语学习相关话题，其他话题礼貌拒绝并引导回学习"""

    # 答错引导模板
    WRONG_ANSWER_TEMPLATE = """当前情境：玩家在学习单词 "{current_word}" 时答错了。
玩家当前等级：Lv.{player_level}
连续答错次数：{wrong_streak}

请你：
1. 先表达共情（例如"这个词确实不好记"）
2. 提供一个创意记忆技巧（可以用词根分析、谐音联想、画面联想等）
3. 给出一个简短的例句帮助理解
4. 用鼓励的语气结尾

注意：不要直接告诉答案，引导玩家自己思考。"""

    # 主动求助模板
    ASK_HELP_TEMPLATE = """当前情境：玩家主动向你求助。
玩家当前等级：Lv.{player_level}
当前章节：{chapter_name}
当前学习的单词：{current_word}

请根据玩家的问题提供帮助。如果涉及单词学习，请提供：
1. 简洁的解释
2. 实用的记忆技巧
3. 有趣的词源知识（如果有的话）"""

    # 关卡总结模板
    LEVEL_SUMMARY_TEMPLATE = """当前情境：玩家刚完成了一个关卡。
章节：{chapter_name}
连续答对次数：{correct_streak}

请：
1. 表扬玩家的表现
2. 简单总结这一关的学习要点
3. 预告下一关的内容
4. 鼓励继续前进"""

    # 情感鼓励模板（连续答错）
    ENCOURAGE_TEMPLATE = """当前情境：玩家连续答错了 {wrong_streak} 题，可能有些沮丧。
玩家等级：Lv.{player_level}

请：
1. 表达理解和安慰（不要显得居高临下）
2. 提供一个简短的学习建议
3. 分享一个有趣的英语小知识来缓解气氛
4. 强烈的鼓励"""

    # 情感鼓励模板（连续答对）
    CELEBRATE_TEMPLATE = """当前情境：玩家连续答对了 {correct_streak} 题，表现非常好！
玩家等级：Lv.{player_level}

请：
1. 热情地庆祝和赞扬
2. 用有趣的方式夸奖（可以用游戏化的说法，如"你的词汇力量在增长！"）
3. 鼓励挑战更高难度"""

    def build_system_prompt(self, context: dict) -> str:
        """根据上下文构建系统Prompt"""
        trigger_type = context.get("triggerType", "manual")
        base = self.BASE_SYSTEM_PROMPT

        # 注入上下文变量
        context_info = f"\n\n当前游戏上下文："
        context_info += f"\n- 当前单词: {context.get('currentWord', '未知')}"
        context_info += f"\n- 玩家等级: Lv.{context.get('playerLevel', 1)}"
        context_info += f"\n- 当前章节: {context.get('chapterName', '初入大陆')}"
        context_info += f"\n- 连续答对: {context.get('correctStreak', 0)}"
        context_info += f"\n- 连续答错: {context.get('wrongStreak', 0)}"
        context_info += self._build_answer_context(context)

        # 根据触发类型添加特定指令
        if trigger_type == "wrong_answer":
            specific = self.WRONG_ANSWER_TEMPLATE.format(**self._get_template_vars(context))
        elif trigger_type == "level_summary":
            specific = self.LEVEL_SUMMARY_TEMPLATE.format(**self._get_template_vars(context))
        elif trigger_type == "encourage":
            wrong_streak = context.get("wrongStreak", 0)
            correct_streak = context.get("correctStreak", 0)
            if wrong_streak >= 3:
                specific = self.ENCOURAGE_TEMPLATE.format(**self._get_template_vars(context))
            elif correct_streak >= 5:
                specific = self.CELEBRATE_TEMPLATE.format(**self._get_template_vars(context))
            else:
                specific = self.ASK_HELP_TEMPLATE.format(**self._get_template_vars(context))
        else:
            specific = self.ASK_HELP_TEMPLATE.format(**self._get_template_vars(context))

        return base + context_info + "\n\n" + specific

    def _build_answer_context(self, context: dict) -> str:
        """构建答题诊断上下文，供 LLM 生成个性化反馈。"""
        if context.get("triggerType") != "wrong_answer":
            return ""

        knowledge = context.get("wordKnowledge") or {}
        lines = [
            "\n\n本次答题诊断：",
            f"- 玩家答案: {context.get('playerAnswer', '未知')}",
            f"- 标准答案: {context.get('correctAnswer', '未知')}",
            f"- 答案质量: {context.get('answerQuality', 'wrong')}",
            f"- 编辑距离: {context.get('editDistance', '未知')}",
            f"- 相似度: {context.get('similarity', '未知')}",
            f"- 系统反馈: {context.get('fuzzyFeedback', '')}",
            "\n词汇知识库：",
            f"- 词根词缀: {knowledge.get('rootAnalysis', '')}",
            f"- 记忆技巧: {knowledge.get('memoryTip', '')}",
            f"- 例句: {knowledge.get('example', '')}",
            f"- 例句翻译: {knowledge.get('exampleTranslation', '')}",
            f"- 同义词: {', '.join(knowledge.get('synonyms', [])[:5]) if isinstance(knowledge.get('synonyms'), list) else ''}",
            f"- 反义词: {', '.join(knowledge.get('antonyms', [])[:5]) if isinstance(knowledge.get('antonyms'), list) else ''}",
            f"- 分类: {knowledge.get('category', '')}",
            "\n反馈要求：结合玩家答案和词汇知识，指出具体错因；如果是拼写错误，说明容易错的位置；给一个可执行的记忆方法。"
        ]
        return "\n".join(lines)

    # 干扰项生成 Prompt
    DISTRACTOR_PROMPT = """你是英语词汇教学专家。请为以下单词生成 {count} 个高质量干扰项（选择题的错误选项）。

目标单词：{word}
释义：{meaning}
难度：{difficulty}

要求：
1. 干扰项与目标词在形态（拼写、长度、前后缀）或语义上相近，但含义不同
2. 干扰项之间的难度应相近
3. 每个干扰项都是真实存在的英语单词
4. 不要包含目标词本身或其变体
5. 不要包含目标词的近义词（那些可能是正确答案）

请只返回一个 JSON 数组，格式如：["word1", "word2", "word3"]"""

    def build_distractor_prompt(self, word: str, meaning: str, count: int = 3, difficulty: str = "intermediate") -> str:
        return self.DISTRACTOR_PROMPT.format(
            word=word,
            meaning=meaning,
            count=count,
            difficulty=difficulty
        )

    def _get_template_vars(self, context: dict) -> dict:
        return {
            "current_word": context.get("currentWord", ""),
            "player_level": context.get("playerLevel", 1),
            "chapter_name": context.get("chapterName", "初入大陆"),
            "correct_streak": context.get("correctStreak", 0),
            "wrong_streak": context.get("wrongStreak", 0),
        }
