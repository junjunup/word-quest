using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class ProgressDto
    {
        public string _id;
        public int currentChapter;
        public int currentLevel;
        public int totalStars;
        public int[] unlockedChapters;
        public AchievementDto[] achievements;
        public int endlessBestScore;
        public int endlessBestStreak;
        public string currentWordbookId;
    }

    [Serializable]
    public sealed class SaveProgressRequest
    {
        public int chapter;
        public int level;
        public int stars;
        public int score;
        public string sessionId;
        public string wordbookId;
    }

    [Serializable]
    public sealed class AchievementDto
    {
        public string id;
        public string name;
        public string description;
        public string unlockedAt;
    }

    [Serializable]
    public sealed class AchievementRequest
    {
        public string id;
        public string name;
        public string description;
    }

    [Serializable]
    public sealed class DailyRewardDto
    {
        public int reward;
        public int loginStreak;
        public int totalExp;
    }

    [Serializable]
    public sealed class CharacterRequest
    {
        public int characterSpriteIndex;
    }

    [Serializable]
    public sealed class LeaderboardEntryDto
    {
        public string _id;
        public string nickname;
        public string avatar;
        public int level;
        public int totalScore;
        public int totalExp;
    }

    [Serializable]
    public sealed class LevelsStatusDto
    {
        public ChapterStatusDto[] chapters;
        public string wordbookId;
        public int maxChapter;
        public int maxLevel;
    }

    [Serializable]
    public sealed class ChapterStatusDto
    {
        public int id;
        public string name;
        public string theme;
        public string description;
        public string color;
        public bool unlocked;
        public LevelStatusDto[] levels;
    }

    [Serializable]
    public sealed class LevelStatusDto
    {
        public int id;
        public string name;
        public string category;
        public int wordsCount;
        public string bossType;
        public bool unlocked;
        public bool completed;
        public int stars;
        public int highScore;
    }

    [Serializable]
    public sealed class EndlessScoreRequest
    {
        public int score;
        public int maxStreak;
    }

    [Serializable]
    public sealed class EndlessScoreDto
    {
        public int bestScore;
        public int bestStreak;
        public bool isNewRecord;
    }
}
