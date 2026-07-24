using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class WordDto
    {
        public string _id;
        public string wordId;
        public string wordbookId;
        public string wordbookName;
        public string word;
        public string meaning;
        public string phonetic;
        public string example;
        public string exampleTranslation;
        public int difficulty;
        public int chapter;
        public int level;
        public string category;
        public string rootAnalysis;
        public string memoryTip;
        public string[] synonyms;
        public string[] antonyms;
        public int masteryScore;
        public int wrongCount;
        public string[] reasons;
    }

    [Serializable]
    public sealed class QuizDto
    {
        public WordDto question;
        public string[] distractors;
        public string strategy;
    }

    [Serializable]
    public sealed class WordbookDto
    {
        public string wordbookId;
        public string name;
        public int total;
        public int[] chapters;
    }

    [Serializable]
    public sealed class VocabularyStatsDto
    {
        public string wordbookId;
        public int total;
        public string[] duplicates;
        public string[] missingFields;
        public string[] invalidRanges;
        public string[] emptyLevels;
        public bool isValid;
    }

    [Serializable]
    public sealed class VocabularyImportRequest
    {
        public WordDto[] words;
        public bool dryRun;
        public string wordbookId;
        public string wordbookName;
    }

    [Serializable]
    public sealed class VocabularyImportDto
    {
        public bool dryRun;
        public int imported;
        public int matched;
        public int modified;
        public int upserted;
    }

    [Serializable]
    public sealed class VocabularySourceManifestDto
    {
        public string generatedAt;
        public string generator;
        public string sourceRepository;
        public string sourceNote;
        public SourceWordbookDto[] wordbooks;
    }

    [Serializable]
    public sealed class SourceWordbookDto
    {
        public string wordbookId;
        public string wordbookName;
        public int wordCount;
        public string outputFile;
        public string outputSha256;
    }
}
