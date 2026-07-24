using System;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Application.Modes
{
    public sealed class EndlessRound
    {
        public int Number { get; internal set; }
        public int Streak { get; internal set; }
        public int Lives { get; internal set; }
        public int Difficulty { get; internal set; }
        public int TimeLimitMs { get; internal set; }
        public QuestionType QuestionType { get; internal set; }
        public int Score { get; internal set; }
    }

    public sealed class EndlessModeController
    {
        private const string BestKey = "wordquest:endless-best";
        private readonly IGameService game;
        private readonly IKeyValueStore store;
        private int round;
        private int streak;
        private int maximumStreak;
        private int lives = 3;
        private int score;

        public EndlessModeController(IGameService game, IKeyValueStore store)
        {
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.store = store ?? throw new ArgumentNullException(nameof(store));
        }

        public EndlessRound NextRound(bool previousCorrect)
        {
            if (round > 0)
            {
                if (previousCorrect)
                {
                    streak++;
                    score += 100 + Math.Min(streak * 10, 100);
                }
                else
                {
                    streak = 0;
                    lives = Math.Max(0, lives - 1);
                }
            }

            round++;
            maximumStreak = Math.Max(maximumStreak, streak);
            var definition = RoundForStreak(streak);
            definition.Number = round;
            definition.Lives = lives;
            definition.Score = score;
            return definition;
        }

        public async Task<ApiResult<EndlessScoreDto>> FinishAsync(
            CancellationToken token)
        {
            var localBest = int.TryParse(store.GetString(BestKey, "0"), out var value)
                ? value
                : 0;
            if (score > localBest)
            {
                store.SetString(BestKey, score.ToString());
                store.Save();
            }

            return await game.SubmitEndlessScoreAsync(
                score,
                maximumStreak,
                token);
        }

        public static EndlessRound RoundForStreak(int streak)
        {
            streak = Math.Max(0, streak);
            var difficulty = streak >= 30
                ? 5
                : streak >= 20
                    ? 4
                    : streak >= 10
                        ? 3
                        : streak >= 5
                            ? 2
                            : 1;
            return new EndlessRound
            {
                Streak = streak,
                Difficulty = difficulty,
                TimeLimitMs = 34000 - difficulty * 4000,
                QuestionType = difficulty <= 2
                    ? QuestionType.ChoiceEnglishToChinese
                    : QuestionType.SpellFull
            };
        }
    }
}
