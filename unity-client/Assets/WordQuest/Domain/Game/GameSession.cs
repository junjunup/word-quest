using System;
using System.Collections.Generic;
using WordQuest.Domain.Quiz;

namespace WordQuest.Domain.Game
{
    public enum SessionStatus
    {
        Continue,
        GameOver,
        Completed
    }

    public sealed class AnswerOutcome
    {
        public AnswerOutcome(SessionStatus status, GameSessionSnapshot snapshot)
        {
            Status = status;
            Snapshot = snapshot;
        }

        public SessionStatus Status { get; }
        public GameSessionSnapshot Snapshot { get; }
    }

    public sealed class GameSessionSnapshot
    {
        internal GameSessionSnapshot(GameSession session)
        {
            Chapter = session.Chapter;
            Level = session.Level;
            Lives = session.Lives;
            MaximumLives = session.MaximumLives;
            TimerMs = session.TimerMs;
            Score = session.Score;
            Combo = session.Combo;
            MaximumCombo = session.MaximumCombo;
            CorrectCount = session.CorrectCount;
            WrongCount = session.WrongCount;
            CurrentWordIndex = session.CurrentWordIndex;
            WordCount = session.Words.Count;
            BossDefeated = session.BossDefeated;
            GraceLifeUsed = session.GraceLifeUsed;
            DifficultyId = session.Difficulty.Id;
            SessionId = session.SessionId;
        }

        public int Chapter { get; }
        public int Level { get; }
        public int Lives { get; }
        public int MaximumLives { get; }
        public int TimerMs { get; }
        public int Score { get; }
        public int Combo { get; }
        public int MaximumCombo { get; }
        public int CorrectCount { get; }
        public int WrongCount { get; }
        public int CurrentWordIndex { get; }
        public int WordCount { get; }
        public bool BossDefeated { get; }
        public bool GraceLifeUsed { get; }
        public string DifficultyId { get; }
        public string SessionId { get; }
        public int AnsweredCount => CorrectCount + WrongCount;
        public int ProgressPercent =>
            WordCount == 0
                ? 0
                : Math.Min(
                    100,
                    (int)Math.Round(AnsweredCount * 100d / WordCount));
    }

    public sealed class LevelResult
    {
        public int Chapter { get; internal set; }
        public int Level { get; internal set; }
        public int Stars { get; internal set; }
        public int Score { get; internal set; }
        public int CorrectCount { get; internal set; }
        public int WrongCount { get; internal set; }
        public int TotalWords { get; internal set; }
        public int CorrectRate { get; internal set; }
        public int MaximumCombo { get; internal set; }
        public long TotalTimeMs { get; internal set; }
        public int AverageTimeMs { get; internal set; }
        public int FastestCorrectMs { get; internal set; }
        public int LivesRemaining { get; internal set; }
        public string SessionId { get; internal set; }
        public string Difficulty { get; internal set; }
        public double ScoreMultiplier { get; internal set; }
        public bool BossDefeated { get; internal set; }
    }

    public sealed class GameSession
    {
        public GameSession(
            int chapter,
            int level,
            IReadOnlyList<Word> words,
            Difficulty difficulty,
            long startedAtUnixMs)
        {
            Chapter = Math.Max(1, chapter);
            Level = Math.Max(1, level);
            Words = words ?? Array.Empty<Word>();
            Difficulty = difficulty ?? Difficulty.For(DifficultyKind.Normal);
            StartedAtUnixMs = Math.Max(0, startedAtUnixMs);
            Lives = Difficulty.Lives;
            MaximumLives = Difficulty.Lives;
            TimerMs = Difficulty.TimerMs;
            SessionId = $"session_{StartedAtUnixMs}_{Guid.NewGuid():N}".Substring(0, 31);
        }

        internal int Chapter { get; }
        internal int Level { get; }
        internal IReadOnlyList<Word> Words { get; }
        internal Difficulty Difficulty { get; }
        internal long StartedAtUnixMs { get; }
        internal int Lives { get; private set; }
        internal int MaximumLives { get; private set; }
        internal int TimerMs { get; private set; }
        internal int Score { get; private set; }
        internal int Combo { get; private set; }
        internal int MaximumCombo { get; private set; }
        internal int CorrectCount { get; private set; }
        internal int WrongCount { get; private set; }
        internal int FastestCorrectMs { get; private set; }
        internal int CurrentWordIndex { get; private set; }
        internal bool BossDefeated { get; private set; }
        internal bool GraceLifeUsed { get; private set; }

        public GameSessionSnapshot Snapshot => new GameSessionSnapshot(this);

        public Word CurrentWord
        {
            get
            {
                if (Words.Count == 0)
                    return null;

                return Words[CurrentWordIndex % Words.Count];
            }
        }

        public AnswerOutcome SubmitAnswer(
            bool correct,
            int responseMs,
            int earnedScore,
            bool deductLife = true)
        {
            if (correct)
            {
                CorrectCount++;
                Combo++;
                MaximumCombo = Math.Max(MaximumCombo, Combo);
                Score += Math.Max(0, earnedScore);
                if (responseMs > 0 &&
                    (FastestCorrectMs == 0 || responseMs < FastestCorrectMs))
                    FastestCorrectMs = responseMs;
            }
            else
            {
                WrongCount++;
                Combo = 0;
                if (deductLife)
                    Lives = Math.Max(0, Lives - 1);
            }

            CurrentWordIndex++;
            var status = Lives <= 0
                ? SessionStatus.GameOver
                : SessionStatus.Continue;
            return new AnswerOutcome(status, Snapshot);
        }

        public SessionStatus LoseLife()
        {
            Lives = Math.Max(0, Lives - 1);
            return Lives <= 0 ? SessionStatus.GameOver : SessionStatus.Continue;
        }

        public bool TryGrantGraceLife()
        {
            if (GraceLifeUsed || Lives > 1)
                return false;

            Lives++;
            GraceLifeUsed = true;
            return true;
        }

        public void EnableTutorialMode()
        {
            Lives = 99;
            MaximumLives = 99;
            TimerMs = 60000;
        }

        public void MarkBossDefeated()
        {
            BossDefeated = true;
        }

        public void AddBonusScore(int score)
        {
            Score += Math.Max(0, score);
        }

        public LevelResult Finish(long endedAtUnixMs)
        {
            var totalTime = Math.Max(0, endedAtUnixMs - StartedAtUnixMs);
            var totalAnswered = CorrectCount + WrongCount;
            var correctRate = totalAnswered > 0
                ? Math.Min(CorrectCount / (double)totalAnswered, 1d)
                : 0d;
            var averageTime = totalAnswered > 0
                ? totalTime / (double)totalAnswered
                : 0d;

            var stars = 0;
            if (Lives > 0)
            {
                if (correctRate >= 0.95d &&
                    averageTime < 8000d &&
                    Lives == MaximumLives)
                {
                    stars = 3;
                }
                else if (correctRate >= 0.8d &&
                         Lives >= (int)Math.Ceiling(MaximumLives / 2d))
                {
                    stars = 2;
                }
                else if (correctRate >= 0.5d)
                {
                    stars = 1;
                }
            }

            return new LevelResult
            {
                Chapter = Chapter,
                Level = Level,
                Stars = stars,
                Score = Score,
                CorrectCount = CorrectCount,
                WrongCount = WrongCount,
                TotalWords = Words.Count,
                CorrectRate = (int)Math.Round(correctRate * 100d),
                MaximumCombo = MaximumCombo,
                TotalTimeMs = totalTime,
                AverageTimeMs = (int)Math.Round(averageTime),
                FastestCorrectMs = FastestCorrectMs,
                LivesRemaining = Lives,
                SessionId = SessionId,
                Difficulty = Difficulty.Id,
                ScoreMultiplier = Difficulty.ScoreMultiplier,
                BossDefeated = BossDefeated
            };
        }
    }
}
