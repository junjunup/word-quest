using System;
using System.Collections.Generic;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Application
{
    public sealed class LearningJourneyPlan
    {
        internal LearningJourneyPlan(
            LevelDefinition recommendedLevel,
            int completedLevels,
            int totalLevels,
            bool hasReliableProgress)
        {
            RecommendedLevel = recommendedLevel;
            CompletedLevels = Math.Max(0, completedLevels);
            TotalLevels = Math.Max(0, totalLevels);
            HasReliableProgress = hasReliableProgress;
        }

        public LevelDefinition RecommendedLevel { get; }
        public int CompletedLevels { get; }
        public int TotalLevels { get; }
        public bool HasReliableProgress { get; }
    }

    public static class LearningJourneyPlanner
    {
        public static LearningJourneyPlan Create(
            ContentCatalog catalog,
            LevelsStatusDto status)
        {
            if (catalog == null)
                throw new ArgumentNullException(nameof(catalog));

            var fallback = catalog.Levels.Count > 0
                ? catalog.Levels[0]
                : null;
            var states = ReadStates(status);
            var reliable =
                status?.chapters != null &&
                states.Count == catalog.Levels.Count;
            if (!reliable)
            {
                return new LearningJourneyPlan(
                    fallback,
                    0,
                    catalog.Levels.Count,
                    false);
            }

            var completed = 0;
            LevelDefinition lastUnlocked = null;
            foreach (var level in catalog.Levels)
            {
                var state = states[(level.Chapter, level.Id)];
                if (state.completed)
                    completed++;
                if (!state.unlocked)
                    continue;
                lastUnlocked = level;
                if (!state.completed)
                {
                    return new LearningJourneyPlan(
                        level,
                        completed,
                        catalog.Levels.Count,
                        true);
                }
            }

            return new LearningJourneyPlan(
                lastUnlocked ?? fallback,
                completed,
                catalog.Levels.Count,
                true);
        }

        public static LevelDefinition NextLevel(
            ContentCatalog catalog,
            LevelDefinition current)
        {
            if (catalog == null)
                throw new ArgumentNullException(nameof(catalog));
            if (current == null)
                return null;

            for (var index = 0; index < catalog.Levels.Count; index++)
            {
                var level = catalog.Levels[index];
                if (level.Chapter != current.Chapter ||
                    level.Id != current.Id)
                    continue;
                return index + 1 < catalog.Levels.Count
                    ? catalog.Levels[index + 1]
                    : null;
            }

            return null;
        }

        private static Dictionary<
                (int chapter, int level),
                (bool unlocked, bool completed)>
            ReadStates(LevelsStatusDto status)
        {
            var states =
                new Dictionary<
                    (int chapter, int level),
                    (bool unlocked, bool completed)>();
            if (status?.chapters == null)
                return states;

            foreach (var chapter in status.chapters)
            {
                if (chapter?.levels == null)
                    continue;
                foreach (var level in chapter.levels)
                {
                    if (level == null)
                        continue;
                    states[(chapter.id, level.id)] =
                        (chapter.unlocked && level.unlocked, level.completed);
                }
            }

            return states;
        }
    }
}
