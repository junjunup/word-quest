using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class PronunciationRequest
    {
        public string wordId;
        public string wordbookId;
        public string word;
        public string expectedPhonetic;
        public string transcript;
        public float confidence;
    }

    [Serializable]
    public sealed class PronunciationResultDto
    {
        public string id;
        public string word;
        public string expectedPhonetic;
        public string transcript;
        public float confidence;
        public int score;
        public string grade;
        public PronunciationDetailsDto details;
        public MasteryWordDto mastery;
        public float masteryDelta;
        public string createdAt;
    }

    [Serializable]
    public sealed class PronunciationDetailsDto
    {
        public float wordSimilarity;
        public float phoneticSimilarity;
        public float confidenceScore;
        public string[] feedback;
    }
}
