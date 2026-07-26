using System;
using System.Collections.Generic;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Application
{
    public sealed class LearnerStageDefinition
    {
        internal LearnerStageDefinition(
            string id,
            string displayName,
            string gradeRange)
        {
            Id = id;
            DisplayName = displayName;
            GradeRange = gradeRange;
        }

        public string Id { get; }
        public string DisplayName { get; }
        public string GradeRange { get; }
    }

    public sealed class WordbookCompatibility
    {
        internal WordbookCompatibility(bool isCompatible)
        {
            IsCompatible = isCompatible;
            Label = isCompatible ? "适合当前学段" : "拓展内容";
        }

        public bool IsCompatible { get; }
        public string Label { get; }
    }

    public static class LearnerStageCatalog
    {
        private static readonly LearnerStageDefinition[] Stages =
        {
            new LearnerStageDefinition(
                "primary",
                "小学",
                "1–6 年级"),
            new LearnerStageDefinition(
                "junior",
                "初中",
                "7–9 年级"),
            new LearnerStageDefinition(
                "senior",
                "高中",
                "10–12 年级")
        };

        public static IReadOnlyList<LearnerStageDefinition> All =>
            Stages;

        public static string Normalize(string stageId)
        {
            return FindKnown(stageId)?.Id ?? "junior";
        }

        public static LearnerStageDefinition Resolve(string stageId)
        {
            var normalized = Normalize(stageId);
            foreach (var stage in Stages)
            {
                if (stage.Id == normalized)
                    return stage;
            }

            return Stages[1];
        }

        public static WordbookCompatibility Evaluate(
            string learnerStageId,
            WordbookDto wordbook)
        {
            var stage = Resolve(learnerStageId);
            wordbook = wordbook ?? new WordbookDto();
            bool compatible;
            if (!string.IsNullOrWhiteSpace(wordbook.stageId))
            {
                var explicitStage = FindKnown(wordbook.stageId);
                compatible = explicitStage != null &&
                             explicitStage.Id == stage.Id;
            }
            else
            {
                var wordbookId =
                    (wordbook.wordbookId ?? string.Empty).Trim();
                compatible = wordbookId.StartsWith(
                    $"k12-{stage.Id}",
                    StringComparison.OrdinalIgnoreCase);
            }

            return new WordbookCompatibility(compatible);
        }

        public static string DescribePath(
            string learnerStageId,
            string wordbookId)
        {
            var stage = Resolve(learnerStageId);
            var fit = Evaluate(
                stage.Id,
                new WordbookDto { wordbookId = wordbookId });
            var content = fit.IsCompatible
                ? "当前词书适合本学段"
                : "当前为拓展词书";
            return $"{stage.DisplayName} · {stage.GradeRange}学习路径 · {content}";
        }

        private static LearnerStageDefinition FindKnown(string stageId)
        {
            var normalized =
                (stageId ?? string.Empty).Trim().ToLowerInvariant();
            foreach (var stage in Stages)
            {
                if (stage.Id == normalized)
                    return stage;
            }

            return null;
        }
    }
}
