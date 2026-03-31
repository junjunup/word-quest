"""
安全过滤器
过滤敏感内容，确保对话在英语学习范围内
"""
import re


class SafetyFilter:
    """输入输出安全过滤"""

    # 敏感话题关键词
    BLOCKED_TOPICS = [
        "政治", "暴力", "色情", "赌博", "毒品", "自杀", "自残",
        "反动", "邪教", "恐怖", "歧视", "仇恨",
        "翻墙", "VPN", "代写", "作弊", "枪支"
    ]

    # 允许的话题关键词
    ALLOWED_TOPICS = [
        "英语", "单词", "词汇", "语法", "句子", "翻译", "发音",
        "记忆", "学习", "考试", "四级", "六级", "雅思", "托福",
        "词根", "词缀", "同义词", "反义词", "例句", "短语",
        "阅读", "写作", "听力", "口语", "词源", "搭配",
        "你好", "谢谢", "帮助", "教", "怎么", "什么",
        "word", "english", "learn", "study", "vocabulary"
    ]

    def check_input(self, text: str) -> bool:
        """检查用户输入是否安全"""
        text_lower = text.lower()

        # 检查敏感词
        for keyword in self.BLOCKED_TOPICS:
            if keyword in text_lower:
                return False

        # 过长输入拒绝（防注入）
        if len(text) > 500:
            return False

        return True

    def filter_output(self, text: str) -> str:
        """过滤模型输出"""
        # 移除可能的敏感内容
        for keyword in self.BLOCKED_TOPICS:
            text = text.replace(keyword, "***")

        # 确保回复不超过300字
        if len(text) > 300:
            text = text[:297] + "..."

        return text

    def is_on_topic(self, text: str) -> bool:
        """检查是否在英语学习话题范围内"""
        text_lower = text.lower()
        # 先检查敏感词（无论长度都要检查）
        for keyword in self.BLOCKED_TOPICS:
            if keyword in text_lower:
                return False
        # 再检查允许的话题
        for keyword in self.ALLOWED_TOPICS:
            if keyword in text_lower:
                return True
        # 短消息（如"嗯"、"好"、"继续"）直接通过
        if len(text) < 10:
            return True
        return False
