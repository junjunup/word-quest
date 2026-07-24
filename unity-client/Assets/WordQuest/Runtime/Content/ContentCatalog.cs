using System;
using System.Collections.Generic;
using UnityEngine;

namespace WordQuest.Content
{
    public sealed class ChapterDefinition
    {
        public ChapterDefinition(
            int id,
            string name,
            string theme,
            string description,
            string color,
            IReadOnlyList<LevelDefinition> levels)
        {
            Id = id;
            Name = name ?? string.Empty;
            Theme = theme ?? string.Empty;
            Description = description ?? string.Empty;
            Color = color ?? string.Empty;
            Levels = levels ?? Array.Empty<LevelDefinition>();
        }

        public int Id { get; }
        public string Name { get; }
        public string Theme { get; }
        public string Description { get; }
        public string Color { get; }
        public IReadOnlyList<LevelDefinition> Levels { get; }
    }

    public sealed class ContentCatalog
    {
        private readonly Dictionary<(int chapter, int level), LevelDefinition>
            byKey;

        private ContentCatalog(
            IReadOnlyList<ChapterDefinition> chapters,
            IReadOnlyList<LevelDefinition> levels,
            Dictionary<(int chapter, int level), LevelDefinition> byKey)
        {
            Chapters = chapters;
            Levels = levels;
            this.byKey = byKey;
        }

        public IReadOnlyList<ChapterDefinition> Chapters { get; }
        public IReadOnlyList<LevelDefinition> Levels { get; }

        public static ContentCatalog LoadDefault()
        {
            var asset = Resources.Load<TextAsset>("Data/levels");
            if (asset == null)
                throw new InvalidOperationException(
                    "Missing Resources/Data/levels.json");
            return LoadFromJson(asset.text);
        }

        public static ContentCatalog LoadFromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
                throw new ArgumentException("Level JSON is empty.", nameof(json));

            var source = JsonUtility.FromJson<CatalogJson>(json);
            if (source?.chapters == null)
                throw new FormatException("Level JSON has no chapters.");

            var chapters = new List<ChapterDefinition>();
            var levels = new List<LevelDefinition>();
            var byKey =
                new Dictionary<(int chapter, int level), LevelDefinition>();

            foreach (var sourceChapter in source.chapters)
            {
                if (sourceChapter == null)
                    continue;

                var chapterLevels = new List<LevelDefinition>();
                foreach (var sourceLevel in sourceChapter.levels ??
                                                   Array.Empty<LevelJson>())
                {
                    if (sourceLevel == null)
                        continue;

                    var definition = new LevelDefinition(
                        sourceChapter.id,
                        sourceLevel.id,
                        sourceLevel.name,
                        sourceLevel.wordsCount,
                        sourceLevel.category,
                        sourceLevel.bossType,
                        string.IsNullOrWhiteSpace(sourceLevel.bossType)
                            ? null
                            : new BossDefinition(
                                sourceLevel.bossConfig?.name,
                                sourceLevel.bossConfig?.baseHp ?? 1,
                                sourceLevel.bossConfig?.speed ?? 0),
                        sourceLevel.isTutorial);
                    var key = (definition.Chapter, definition.Id);
                    if (byKey.ContainsKey(key))
                    {
                        throw new FormatException(
                            $"Duplicate level {key.Item1}-{key.Item2}.");
                    }

                    byKey[key] = definition;
                    chapterLevels.Add(definition);
                    levels.Add(definition);
                }

                chapters.Add(new ChapterDefinition(
                    sourceChapter.id,
                    sourceChapter.name,
                    sourceChapter.theme,
                    sourceChapter.description,
                    sourceChapter.color,
                    chapterLevels.AsReadOnly()));
            }

            return new ContentCatalog(
                chapters.AsReadOnly(),
                levels.AsReadOnly(),
                byKey);
        }

        public LevelDefinition GetLevel(int chapter, int level)
        {
            if (!byKey.TryGetValue((chapter, level), out var definition))
                throw new KeyNotFoundException($"Unknown level {chapter}-{level}.");
            return definition;
        }

        public ChapterTheme GetTheme(int chapter)
        {
            return ChapterTheme.ForChapter(chapter);
        }

        [Serializable]
        private sealed class CatalogJson
        {
            public ChapterJson[] chapters;
        }

        [Serializable]
        private sealed class ChapterJson
        {
            public int id;
            public string name;
            public string theme;
            public string description;
            public string color;
            public LevelJson[] levels;
        }

        [Serializable]
        private sealed class LevelJson
        {
            public int id;
            public string name;
            public int wordsCount;
            public string category;
            public string bossType;
            public BossJson bossConfig;
            public bool isTutorial;
        }

        [Serializable]
        private sealed class BossJson
        {
            public string name;
            public int baseHp;
            public float speed;
        }
    }
}
