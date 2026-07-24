using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class ChatRequest
    {
        public string message;
        public ChatContextDto context;
    }

    [Serializable]
    public sealed class ChatContextDto
    {
        public string currentWord;
        public int playerLevel;
        public int correctStreak;
        public int wrongStreak;
        public string chapterName;
        public string triggerType;
        public string correctAnswer;
        public string playerAnswer;
        public string answerQuality;
        public int editDistance;
        public float similarity;
        public string fuzzyFeedback;
    }

    [Serializable]
    public sealed class ChatResponseDto
    {
        public string content;
        public string result;
        public string message;
    }

    [Serializable]
    public sealed class ChatDeltaDto
    {
        public string content;
        public string result;
        public string error;
    }
}
