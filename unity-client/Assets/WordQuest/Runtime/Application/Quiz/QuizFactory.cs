using System;
using System.Collections.Generic;
using System.Linq;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Application.Quiz
{
    public static class QuizFactory
    {
        private static readonly string[] MeaningFallbacks =
        {
            "一种常见事物",
            "描述某种变化",
            "表示一个动作",
            "与时间有关",
            "与学习有关"
        };

        private static readonly string[] WordFallbacks =
        {
            "journey",
            "memory",
            "garden",
            "wisdom",
            "practice"
        };

        public static QuizQuestion Create(
            WordDto word,
            QuestionType type,
            IReadOnlyList<WordDto> pool)
        {
            if (word == null)
                throw new ArgumentNullException(nameof(word));

            var id = string.IsNullOrEmpty(word._id) ? word.wordId : word._id;
            switch (type)
            {
                case QuestionType.ChoiceChineseToEnglish:
                    return Choice(
                        id,
                        type,
                        word.meaning,
                        word.word,
                        pool,
                        candidate => candidate.word,
                        WordFallbacks);
                case QuestionType.ChoiceEnglishToChinese:
                    return Choice(
                        id,
                        type,
                        word.word,
                        word.meaning,
                        pool,
                        candidate => candidate.meaning,
                        MeaningFallbacks);
                case QuestionType.SpellHint:
                    return new QuizQuestion(
                        id,
                        type,
                        $"{word.meaning} · {BuildHint(word.word)}",
                        word.word,
                        Array.Empty<QuizOption>());
                case QuestionType.Translate:
                    return new QuizQuestion(
                        id,
                        type,
                        $"翻译为英文：{word.meaning}",
                        word.word,
                        Array.Empty<QuizOption>());
                case QuestionType.Pronunciation:
                    return new QuizQuestion(
                        id,
                        type,
                        $"朗读：{word.word} {word.phonetic}",
                        word.word,
                        Array.Empty<QuizOption>());
                default:
                    return new QuizQuestion(
                        id,
                        QuestionType.SpellFull,
                        word.meaning,
                        word.word,
                        Array.Empty<QuizOption>());
            }
        }

        private static QuizQuestion Choice(
            string id,
            QuestionType type,
            string prompt,
            string correct,
            IReadOnlyList<WordDto> pool,
            Func<WordDto, string> selector,
            IEnumerable<string> fallbacks)
        {
            var values = new List<string>();
            AddUnique(values, correct);

            foreach (var candidate in pool ?? Array.Empty<WordDto>())
            {
                if (values.Count >= 4)
                    break;
                AddUnique(values, selector(candidate));
            }

            foreach (var fallback in fallbacks)
            {
                if (values.Count >= 4)
                    break;
                AddUnique(values, fallback);
            }

            var ordered = values
                .Take(4)
                .OrderBy(value => StableHash(id + ":" + value))
                .Select((value, index) =>
                    new QuizOption(index.ToString(), value))
                .ToArray();

            return new QuizQuestion(id, type, prompt, correct, ordered);
        }

        private static void AddUnique(ICollection<string> values, string value)
        {
            value = value?.Trim();
            if (string.IsNullOrWhiteSpace(value))
                return;
            if (values.Any(existing =>
                    string.Equals(
                        existing,
                        value,
                        StringComparison.OrdinalIgnoreCase)))
                return;
            values.Add(value);
        }

        private static string BuildHint(string word)
        {
            if (string.IsNullOrEmpty(word))
                return string.Empty;
            if (word.Length <= 2)
                return word[0] + "…";
            return word[0] + new string('_', word.Length - 2) + word[word.Length - 1];
        }

        private static int StableHash(string value)
        {
            unchecked
            {
                var hash = 17;
                foreach (var character in value ?? string.Empty)
                    hash = hash * 31 + character;
                return hash;
            }
        }
    }

    public static class QuizRotation
    {
        private static readonly QuestionType[] Sequence =
        {
            QuestionType.ChoiceEnglishToChinese,
            QuestionType.ChoiceChineseToEnglish,
            QuestionType.SpellHint,
            QuestionType.SpellFull,
            QuestionType.Translate
        };

        public static QuestionType ForAnsweredCount(int answeredCount)
        {
            return Sequence[Math.Max(0, answeredCount) % Sequence.Length];
        }

        public static QuestionType ParseServerSuggestion(
            string value,
            QuestionType fallback)
        {
            switch (value)
            {
                case "choice_cn2en": return QuestionType.ChoiceChineseToEnglish;
                case "spell_hint": return QuestionType.SpellHint;
                case "spell_full": return QuestionType.SpellFull;
                case "translate": return QuestionType.Translate;
                case "choice_en2cn": return QuestionType.ChoiceEnglishToChinese;
                default: return fallback;
            }
        }
    }

    public sealed class AdaptiveQuizPolicy
    {
        public int ConsecutiveErrors { get; private set; }

        public QuestionType Select(QuestionType requested)
        {
            return ConsecutiveErrors >= 2
                ? QuestionType.ChoiceEnglishToChinese
                : requested;
        }

        public int EffectiveDifficulty(int requested)
        {
            return ConsecutiveErrors >= 3 ? 1 : Math.Max(1, requested);
        }

        public void Record(bool correct)
        {
            ConsecutiveErrors = correct ? 0 : ConsecutiveErrors + 1;
        }
    }
}
