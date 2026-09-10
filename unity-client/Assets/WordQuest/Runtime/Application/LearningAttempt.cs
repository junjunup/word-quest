using System;
using UnityEngine;
using WordQuest.Domain.Quiz;
using WordQuest.Gameplay;
using WordQuest.Infrastructure.Api.Dto;
namespace WordQuest.Application
{
    public static class LearningAttempt
    {
        public static QuizRecordRequest Create(WordDto word, QuizQuestion question,
            string encounterId, string sessionId, string wordbookId, int chapter, int level,
            string answer, int responseMs)
        {
            var hint = question.Type == QuestionType.SpellHint;
            var type = ApiType(question.Type);
            return new QuizRecordRequest {
                attemptId = Guid.NewGuid().ToString("N"), encounterId = encounterId,
                attemptPhase = "first", assistance = hint ? "partial" : "none",
                wordId = string.IsNullOrEmpty(word._id) ? word.wordId : word._id, word = word.word,
                wordbookId = wordbookId, questionType = type, recommendedType = type, presentedType = type,
                recallMode = type.StartsWith("choice") ? "recognition" : "recall", hintUsed = hint,
                sessionId = sessionId, chapter = chapter, level = level, playerAnswer = answer,
                responseTime = responseMs, timeLimit = 0, difficulty = Math.Max(1, word.difficulty), sourceMode = "mainline"
            };
        }
        public static QuizRecordRequest Correction(QuizRecordRequest first, string answer, int responseMs)
        {
            var result = JsonUtility.FromJson<QuizRecordRequest>(JsonUtility.ToJson(first));
            result.attemptId = Guid.NewGuid().ToString("N");
            result.attemptPhase = "correction"; result.assistance = "answer_shown";
            result.questionType = "spell_full"; result.presentedType = "spell_full";
            result.recallMode = "recall"; result.playerAnswer = answer; result.responseTime = responseMs;
            result.hintUsed = true; result.combo = 0; result.timeLimit = 0;
            return result;
        }
        public static string ApiType(QuestionType type)
        {
            switch (type) {
                case QuestionType.ChoiceChineseToEnglish: return "choice_cn2en";
                case QuestionType.SpellHint: return "spell_hint";
                case QuestionType.SpellFull: return "spell_full";
                case QuestionType.Translate: return "translate";
                default: return "choice_en2cn";
            }
        }
    }
}
