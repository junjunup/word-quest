using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class DailyChallengeDto
    {
        public string id;
        public string date;
        public string wordbookId;
        public string wordbookName;
        public int questionCount;
        public string status;
        public bool completed;
        public DailyAttemptDto attempt;
        public DailyQuestionDto[] questions;
        public int masteryUpdated;
    }

    [Serializable]
    public sealed class DailyQuestionDto
    {
        public string wordId;
        public string word;
        public string phonetic;
        public string example;
        public string exampleTranslation;
        public string[] options;
    }

    [Serializable]
    public sealed class DailyAttemptDto
    {
        public int score;
        public int correctCount;
        public int questionCount;
        public int durationMs;
        public int streak;
        public int rewardExp;
        public string rewardTitle;
        public string completedAt;
    }

    [Serializable]
    public sealed class DailyChallengeSubmitRequest
    {
        public ChallengeAnswerDto[] answers;
        public int durationMs;
    }

    [Serializable]
    public sealed class DailyLeaderboardEntryDto
    {
        public int rank;
        public PublicUserDto user;
        public int score;
        public int correctCount;
        public int questionCount;
        public int durationMs;
        public int streak;
        public string rewardTitle;
        public string completedAt;
    }
}
