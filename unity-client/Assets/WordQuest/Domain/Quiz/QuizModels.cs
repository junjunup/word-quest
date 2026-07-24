using System;
using System.Collections.Generic;

namespace WordQuest.Domain.Quiz
{
    public enum QuestionType
    {
        ChoiceEnglishToChinese,
        ChoiceChineseToEnglish,
        Spelling,
        Pronunciation
    }

    public sealed class Word
    {
        public Word(
            string id,
            string text,
            string meaning,
            string phonetic,
            string example,
            int difficulty)
        {
            Id = id ?? string.Empty;
            Text = text ?? string.Empty;
            Meaning = meaning ?? string.Empty;
            Phonetic = phonetic ?? string.Empty;
            Example = example ?? string.Empty;
            Difficulty = Math.Max(1, Math.Min(difficulty, 10));
        }

        public string Id { get; }
        public string Text { get; }
        public string Meaning { get; }
        public string Phonetic { get; }
        public string Example { get; }
        public int Difficulty { get; }
    }

    public sealed class QuizOption
    {
        public QuizOption(string id, string text)
        {
            Id = id ?? string.Empty;
            Text = text ?? string.Empty;
        }

        public string Id { get; }
        public string Text { get; }
    }

    public sealed class QuizQuestion
    {
        public QuizQuestion(
            string wordId,
            QuestionType type,
            string prompt,
            string correctAnswer,
            IReadOnlyList<QuizOption> options)
        {
            WordId = wordId ?? string.Empty;
            Type = type;
            Prompt = prompt ?? string.Empty;
            CorrectAnswer = correctAnswer ?? string.Empty;
            Options = options ?? Array.Empty<QuizOption>();
        }

        public string WordId { get; }
        public QuestionType Type { get; }
        public string Prompt { get; }
        public string CorrectAnswer { get; }
        public IReadOnlyList<QuizOption> Options { get; }
    }

    public sealed class AnswerRecord
    {
        public AnswerRecord(
            string wordId,
            QuestionType type,
            string answer,
            bool correct,
            int responseMs,
            double scoreRatio,
            string errorType)
        {
            WordId = wordId ?? string.Empty;
            Type = type;
            Answer = answer ?? string.Empty;
            Correct = correct;
            ResponseMs = Math.Max(0, responseMs);
            ScoreRatio = Math.Max(0d, Math.Min(scoreRatio, 1d));
            ErrorType = errorType ?? string.Empty;
        }

        public string WordId { get; }
        public QuestionType Type { get; }
        public string Answer { get; }
        public bool Correct { get; }
        public int ResponseMs { get; }
        public double ScoreRatio { get; }
        public string ErrorType { get; }
    }
}
