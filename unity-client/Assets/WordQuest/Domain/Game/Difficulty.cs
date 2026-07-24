using System;

namespace WordQuest.Domain.Game
{
    public enum DifficultyKind
    {
        Easy,
        Normal,
        Hard
    }

    public sealed class Difficulty
    {
        private Difficulty(
            DifficultyKind kind,
            string id,
            string label,
            int lives,
            int timerMs,
            double scoreMultiplier,
            int monsterModifier)
        {
            Kind = kind;
            Id = id;
            Label = label;
            Lives = lives;
            TimerMs = timerMs;
            ScoreMultiplier = scoreMultiplier;
            MonsterModifier = monsterModifier;
        }

        public DifficultyKind Kind { get; }
        public string Id { get; }
        public string Label { get; }
        public int Lives { get; }
        public int TimerMs { get; }
        public double ScoreMultiplier { get; }
        public int MonsterModifier { get; }

        public static Difficulty For(DifficultyKind kind)
        {
            switch (kind)
            {
                case DifficultyKind.Easy:
                    return new Difficulty(kind, "easy", "简单", 4, 35000, 0.8d, -2);
                case DifficultyKind.Hard:
                    return new Difficulty(kind, "hard", "困难", 2, 20000, 1.5d, 3);
                default:
                    return new Difficulty(
                        DifficultyKind.Normal,
                        "normal",
                        "普通",
                        3,
                        30000,
                        1d,
                        0);
            }
        }

        public static Difficulty Parse(string value)
        {
            if (string.Equals(value, "easy", StringComparison.OrdinalIgnoreCase))
                return For(DifficultyKind.Easy);
            if (string.Equals(value, "hard", StringComparison.OrdinalIgnoreCase))
                return For(DifficultyKind.Hard);

            return For(DifficultyKind.Normal);
        }

        public int MonsterCount(int baseCount)
        {
            return Math.Max(1, Math.Min(baseCount + MonsterModifier, 15));
        }
    }
}
