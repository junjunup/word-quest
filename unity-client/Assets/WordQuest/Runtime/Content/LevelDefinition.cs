using System;

namespace WordQuest.Content
{
    public sealed class BossDefinition
    {
        public BossDefinition(string name, int baseHitPoints, float speed)
        {
            Name = name ?? "守关者";
            BaseHitPoints = Math.Max(1, baseHitPoints);
            Speed = Math.Max(0f, speed);
        }

        public string Name { get; }
        public int BaseHitPoints { get; }
        public float Speed { get; }
    }

    public sealed class LevelDefinition
    {
        public LevelDefinition(
            int chapter,
            int id,
            string name,
            int wordsCount,
            string category,
            string bossType,
            BossDefinition boss,
            bool tutorial)
        {
            Chapter = Math.Max(1, chapter);
            Id = Math.Max(1, id);
            Name = name ?? $"第 {Id} 关";
            WordsCount = Math.Max(0, wordsCount);
            Category = category ?? string.Empty;
            BossType = bossType ?? string.Empty;
            Boss = boss;
            IsTutorial = tutorial;
        }

        public int Chapter { get; }
        public int Id { get; }
        public string Name { get; }
        public int WordsCount { get; }
        public string Category { get; }
        public string BossType { get; }
        public BossDefinition Boss { get; }
        public bool IsTutorial { get; }
    }
}
