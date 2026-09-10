using System;
namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable] public sealed class DailyFeedbackRequest { public string wordId; }
    [Serializable] public sealed class DailyFeedbackDto { public string wordId; public string playerAnswer; public bool isCorrect; }
    [Serializable] public sealed class DailyLearningRequest { public string wordbookId; }
    [Serializable] public sealed class DailyLearningSessionDto
    {
        public string sessionId;
        public string wordbookId;
        public string dateKey;
        public string status;
        public bool isPreviousDay;
        public WordDto[] items;
        public string[] completedWordIds;
        public DailyFeedbackDto[] pendingFeedback;
        public int independentCorrect;
        public DailyReviewWordDto[] reviewWords;
    }
    [Serializable] public sealed class DailyReviewWordDto { public string wordId; public string word; public string nextReviewAt; }
    [Serializable] public sealed class EvidenceCountDto { public int total; public int correct; }
    [Serializable] public sealed class EvidenceWordDto { public string wordId; public string word; public string state; public string nextReviewAt; }
    [Serializable] public sealed class LearningEvidenceDto
    {
        public EvidenceCountDto recall;
        public EvidenceCountDto recognition;
        public EvidenceCountDto assisted;
        public EvidenceCountDto correction;
        public EvidenceCountDto unknown;
        public int delayedPassed;
        public EvidenceWordDto[] words;
    }
}
