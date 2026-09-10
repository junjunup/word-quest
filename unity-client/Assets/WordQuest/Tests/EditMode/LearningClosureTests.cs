using NUnit.Framework;
using WordQuest.Domain.Game;
using WordQuest.Application;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;
using System;

namespace WordQuest.Tests
{
    public sealed class LearningClosureTests
    {
        [Test]
        public void Resume_waits_until_held_input_is_released()
        {
            var gate = new InputResumeGate();
            Assert.That(gate.Accept(true), Is.True);
            gate.RequireNeutral();
            Assert.That(gate.Accept(true), Is.False);
            Assert.That(gate.Accept(false), Is.False);
            Assert.That(gate.Accept(true), Is.True);
        }
        [Test]
        public void Attempt_identity_and_assistance_are_explicit_and_correction_is_separate()
        {
            var word = new WordDto { _id = "word", word = "river", meaning = "河流" };
            var question = new QuizQuestion("word", QuestionType.SpellHint, "河流 r___r", "river", Array.Empty<QuizOption>());
            var first = LearningAttempt.Create(word, question, "encounter", "session", "cet4", 1, 1, "river", 1234);
            Assert.That(first.attemptPhase, Is.EqualTo("first"));
            Assert.That(first.assistance, Is.EqualTo("partial"));
            Assert.That(first.hintUsed, Is.True);
            var correction = LearningAttempt.Correction(first, "river", 2000);
            Assert.That(correction.attemptId, Is.Not.EqualTo(first.attemptId));
            Assert.That(correction.encounterId, Is.EqualTo(first.encounterId));
            Assert.That(correction.attemptPhase, Is.EqualTo("correction"));
            Assert.That(correction.assistance, Is.EqualTo("answer_shown"));
        }
        [Test]
        public void Daily_resume_uses_only_unfinished_words_and_keeps_fixed_denominator()
        {
            var session = new DailyLearningSessionDto { items = new[] {
                new WordDto { _id = "1" }, new WordDto { _id = "2" } }, completedWordIds = new[] { "1" } };
            Assert.That(DailyLearningPlan.Remaining(session).Length, Is.EqualTo(1));
            Assert.That(DailyLearningPlan.Remaining(session)[0]._id, Is.EqualTo("2"));
            Assert.That(session.items.Length, Is.EqualTo(2));
        }
    }
}
