using NUnit.Framework;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;

namespace WordQuest.Tests
{
    public sealed class GameSessionTests
    {
        [TestCase(SessionStatus.GameOver, true, false)]
        [TestCase(SessionStatus.Continue, false, false)]
        [TestCase(SessionStatus.Continue, true, true)]
        public void Progress_is_saved_only_for_a_live_completed_run(
            SessionStatus status,
            bool objectivesComplete,
            bool expected)
        {
            Assert.That(
                LevelSettlementPolicy.ShouldPersistProgress(
                    status,
                    objectivesComplete),
                Is.EqualTo(expected));
        }

        [TestCase(true, false, false)]
        [TestCase(false, true, false)]
        [TestCase(true, true, true)]
        public void Achievements_wait_for_confirmed_progress_save(
            bool levelCompleted,
            bool progressSaved,
            bool expected)
        {
            Assert.That(
                LevelSettlementPolicy.ShouldSyncAchievements(
                    levelCompleted,
                    progressSaved),
                Is.EqualTo(expected));
        }

        [TestCase(DifficultyKind.Easy, 4)]
        [TestCase(DifficultyKind.Normal, 3)]
        [TestCase(DifficultyKind.Hard, 2)]
        public void Starts_with_web_difficulty_lives(
            DifficultyKind difficulty,
            int expectedLives)
        {
            var session = NewSession(difficulty);

            Assert.That(session.Snapshot.Lives, Is.EqualTo(expectedLives));
        }

        [Test]
        public void Wrong_answer_resets_combo_and_reaches_game_over()
        {
            var session = NewSession(DifficultyKind.Hard);
            session.SubmitAnswer(true, 1000, 100);

            var firstWrong = session.SubmitAnswer(false, 1000, 0);
            var secondWrong = session.SubmitAnswer(false, 1000, 0);

            Assert.That(firstWrong.Status, Is.EqualTo(SessionStatus.Continue));
            Assert.That(secondWrong.Status, Is.EqualTo(SessionStatus.GameOver));
            Assert.That(session.Snapshot.Combo, Is.Zero);
            Assert.That(session.Snapshot.Lives, Is.Zero);
        }

        [Test]
        public void Grace_life_can_only_be_granted_once()
        {
            var session = NewSession(DifficultyKind.Hard);
            session.LoseLife();

            Assert.That(session.TryGrantGraceLife(), Is.True);
            session.LoseLife();
            Assert.That(session.TryGrantGraceLife(), Is.False);
        }

        [Test]
        public void Tutorial_uses_ninety_nine_lives_and_sixty_seconds()
        {
            var session = NewSession(DifficultyKind.Normal);

            session.EnableTutorialMode();

            Assert.That(session.Snapshot.Lives, Is.EqualTo(99));
            Assert.That(session.Snapshot.TimerMs, Is.EqualTo(60000));
        }

        [Test]
        public void Session_identity_is_stable_from_snapshot_to_result()
        {
            var session = NewSession(DifficultyKind.Normal);

            var snapshotId = session.Snapshot.SessionId;
            var resultId = session.Finish(2000).SessionId;

            Assert.That(snapshotId, Is.Not.Empty);
            Assert.That(resultId, Is.EqualTo(snapshotId));
        }

        [Test]
        public void Failed_run_cannot_report_saved_or_pending_progress()
        {
            var result = NewSession(DifficultyKind.Normal).Finish(2000);

            result.RecordSettlement(
                false,
                true,
                true,
                "must-not-survive");

            Assert.That(result.LevelCompleted, Is.False);
            Assert.That(result.ProgressSaved, Is.False);
            Assert.That(result.ProgressPending, Is.False);
            Assert.That(result.SettlementId, Is.Empty);
        }

        [Test]
        public void Confirmed_save_takes_precedence_over_pending_retry()
        {
            var result = NewSession(DifficultyKind.Normal).Finish(2000);

            result.RecordSettlement(
                true,
                true,
                true,
                "settlement-1");

            Assert.That(result.LevelCompleted, Is.True);
            Assert.That(result.ProgressSaved, Is.True);
            Assert.That(result.ProgressPending, Is.False);
            Assert.That(result.SettlementId, Is.EqualTo("settlement-1"));
        }

        [TestCase(true, false, null)]
        [TestCase(true, false, "")]
        [TestCase(true, false, "  ")]
        [TestCase(false, true, null)]
        [TestCase(false, true, "")]
        [TestCase(false, true, "  ")]
        public void Persisted_settlement_requires_a_non_blank_identity(
            bool progressSaved,
            bool progressPending,
            string settlementId)
        {
            var result = NewSession(DifficultyKind.Normal).Finish(2000);

            Assert.Throws<System.ArgumentException>(() =>
                result.RecordSettlement(
                    true,
                    progressSaved,
                    progressPending,
                    settlementId));
        }

        [TestCase(20, 0, 100000, 3)]
        [TestCase(16, 4, 160000, 2)]
        [TestCase(10, 10, 200000, 1)]
        public void Finish_matches_web_star_thresholds(
            int correct,
            int wrong,
            long durationMs,
            int expectedStars)
        {
            var session = new GameSession(
                1,
                1,
                BuildWords(20),
                Difficulty.For(DifficultyKind.Easy),
                1000);

            for (var index = 0; index < correct; index++)
                session.SubmitAnswer(true, 1000, 100);
            for (var index = 0; index < wrong; index++)
                session.SubmitAnswer(false, 1000, 0, false);

            var result = session.Finish(1000 + durationMs);

            Assert.That(result.Stars, Is.EqualTo(expectedStars));
        }

        private static GameSession NewSession(DifficultyKind difficulty)
        {
            return new GameSession(
                1,
                1,
                BuildWords(20),
                Difficulty.For(difficulty),
                1000);
        }

        private static Word[] BuildWords(int count)
        {
            var words = new Word[count];
            for (var index = 0; index < count; index++)
            {
                words[index] = new Word(
                    index.ToString(),
                    "word" + index,
                    "meaning" + index,
                    string.Empty,
                    string.Empty,
                    1);
            }

            return words;
        }
    }
}
