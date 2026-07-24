using System;
using System.Collections.Generic;
using System.Linq;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Application.Modes
{
    public static class ModeAnswerPolicy
    {
        public static bool IsCorrect(string answer, string expected)
        {
            if (string.IsNullOrWhiteSpace(answer) ||
                string.IsNullOrWhiteSpace(expected))
                return false;

            return string.Equals(
                answer.Trim(),
                expected.Trim(),
                StringComparison.OrdinalIgnoreCase);
        }

        public static ReviewAnswerDto CreateReviewAnswer(
            WordDto word,
            string playerAnswer,
            int responseTimeMs,
            int timeLimitMs)
        {
            if (word == null)
                throw new ArgumentNullException(nameof(word));

            var normalized = playerAnswer?.Trim() ?? string.Empty;
            return new ReviewAnswerDto
            {
                wordId = string.IsNullOrWhiteSpace(word._id)
                    ? word.wordId
                    : word._id,
                playerAnswer = normalized,
                answer = word.meaning?.Trim() ?? string.Empty,
                isCorrect = IsCorrect(normalized, word.meaning),
                responseTime = Math.Max(0, responseTimeMs),
                timeLimit = Math.Max(0, timeLimitMs)
            };
        }

        public static bool CanSubmitDaily(
            IReadOnlyList<DailyQuestionDto> questions,
            IReadOnlyDictionary<string, string> answers)
        {
            if (questions == null || questions.Count == 0 || answers == null)
                return false;

            return questions.All(question =>
                question != null &&
                !string.IsNullOrWhiteSpace(question.wordId) &&
                answers.TryGetValue(question.wordId, out var answer) &&
                !string.IsNullOrWhiteSpace(answer));
        }

        public static ChallengeAnswerDto[] CreateDailyAnswers(
            IReadOnlyList<DailyQuestionDto> questions,
            IReadOnlyDictionary<string, string> answers)
        {
            if (!CanSubmitDaily(questions, answers))
                return Array.Empty<ChallengeAnswerDto>();

            return questions.Select(question => new ChallengeAnswerDto
            {
                wordId = question.wordId,
                answer = answers[question.wordId].Trim()
            }).ToArray();
        }
    }
}
