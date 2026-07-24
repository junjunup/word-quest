using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class QuizRecordRequest
    {
        public string wordId;
        public string wordbookId;
        public string word;
        public string questionType;
        public string sourceMode;
        public bool isCorrect;
        public int responseTime;
        public int timeLimit;
        public int difficulty;
        public bool hintUsed;
        public bool npcInteraction;
        public string sessionId;
        public int chapter;
        public int level;
        public string playerAnswer;
        public string correctAnswer;
        public int combo;
        public string answerQuality;
        public int editDistance;
        public float similarity;
        public float scoreRatio;
        public string fuzzyFeedback;
    }

    [Serializable]
    public sealed class QuizRecordResultDto
    {
        public int adaptiveDifficulty;
        public bool serverVerified;
        public bool serverIsCorrect;
        public int serverScore;
        public string errorType;
        public string answerQuality;
        public int editDistance;
        public float similarity;
        public float scoreRatio;
        public string fuzzyFeedback;
        public MasteryWordDto mastery;
        public float masteryDelta;
    }

    [Serializable]
    public sealed class MasterySummaryDto
    {
        public int total;
        public int mastered;
        public int learning;
        public int newWords;
        public int due;
        public float averageScore;
    }

    [Serializable]
    public sealed class MasteryWordDto
    {
        public string _id;
        public string wordId;
        public string word;
        public float masteryScore;
        public int correctCount;
        public int wrongCount;
        public string nextReviewAt;
        public string[] recentErrorTypes;
    }

    [Serializable]
    public sealed class ReviewSessionRequest
    {
        public string wordbookId;
        public int limit;
    }

    [Serializable]
    public sealed class ReviewSessionDto
    {
        public string sessionId;
        public WordDto[] words;
        public int masteryUpdated;
        public ReviewMasteryResultDto[] results;
    }

    [Serializable]
    public sealed class ReviewSubmissionRequest
    {
        public ReviewAnswerDto[] answers;
    }

    [Serializable]
    public sealed class ReviewAnswerDto
    {
        public string wordId;
        public string playerAnswer;
        public string answer;
        public bool isCorrect;
        public int responseTime;
        public int timeLimit;
    }

    [Serializable]
    public sealed class ReviewMasteryResultDto
    {
        public string masteryId;
        public string word;
        public float masteryScore;
        public string nextReviewAt;
        public float delta;
    }

    [Serializable]
    public sealed class LearningStatsDto
    {
        public int totalQuizzes;
        public string correctRate;
        public int wordsLearned;
        public int wordsMastered;
        public int totalStudyTime;
        public int totalVocabCount;
        public string wordbookId;
        public MasterySummaryDto masterySummary;
    }

    [Serializable]
    public sealed class ErrorTypeStatsDto
    {
        public string wordbookId;
        public int days;
        public ErrorTypeCountDto[] errorTypes;
        public SourceModeCountDto[] sourceModes;
    }

    [Serializable]
    public sealed class ErrorTypeCountDto
    {
        public string errorType;
        public int count;
    }

    [Serializable]
    public sealed class SourceModeCountDto
    {
        public string sourceMode;
        public int count;
    }

    [Serializable]
    public sealed class DailyStatDto
    {
        public string _id;
        public int total;
        public int correct;
        public float avgTime;
    }

    [Serializable]
    public sealed class ChapterStatDto
    {
        public int chapter;
        public string correctRate;
        public int total;
    }

    [Serializable]
    public sealed class MistakeDto
    {
        public string _id;
        public string wordId;
        public string word;
        public string meaning;
        public string phonetic;
        public string example;
        public string exampleTranslation;
        public int difficulty;
        public int wrongCount;
        public int totalCount;
        public float errorRate;
    }
}
