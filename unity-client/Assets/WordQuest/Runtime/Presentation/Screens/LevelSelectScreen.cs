using System;
using System.Collections.Generic;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class LevelSelectScreen
    {
        public LevelSelectScreen(
            VisualElement view,
            ContentCatalog catalog,
            Action<LevelDefinition> selected,
            Action<string> difficultyChanged = null,
            LevelsStatusDto status = null,
            IReadOnlyList<WordbookDto> wordbooks = null,
            string currentWordbookId = "cet4",
            string currentDifficulty = "normal",
            Action<string> wordbookChanged = null,
            LearningJourneyPlan journey = null)
        {
            if (view == null)
                throw new ArgumentNullException(nameof(view));
            if (catalog == null)
                throw new ArgumentNullException(nameof(catalog));

            RenderJourneySummary(view, journey);
            var list = view.Q<ScrollView>("level-list");
            if (list == null)
                return;

            var wordbook = view.Q<DropdownField>("wordbook-field");
            var available = wordbooks == null || wordbooks.Count == 0
                ? new[]
                {
                    new WordbookDto
                    {
                        wordbookId = currentWordbookId,
                        name = currentWordbookId.ToUpperInvariant()
                    }
                }
                : new List<WordbookDto>(wordbooks).ToArray();
            var wordbookNames = new List<string>();
            var selectedWordbookName = string.Empty;
            foreach (var item in available)
            {
                var name = string.IsNullOrWhiteSpace(item.name)
                    ? item.wordbookId.ToUpperInvariant()
                    : item.name;
                wordbookNames.Add(name);
                if (string.Equals(
                        item.wordbookId,
                        currentWordbookId,
                        StringComparison.OrdinalIgnoreCase))
                    selectedWordbookName = name;
            }
            wordbook.choices = wordbookNames;
            wordbook.value = string.IsNullOrWhiteSpace(selectedWordbookName)
                ? wordbookNames[0]
                : selectedWordbookName;
            wordbook.RegisterValueChangedCallback(change =>
            {
                for (var index = 0; index < wordbookNames.Count; index++)
                {
                    if (wordbookNames[index] != change.newValue)
                        continue;
                    wordbookChanged?.Invoke(available[index].wordbookId);
                    break;
                }
            });
            var difficulty = view.Q<DropdownField>("difficulty-field");
            difficulty.choices = new List<string> { "简单", "普通", "困难" };
            difficulty.value = currentDifficulty == "easy"
                ? "简单"
                : currentDifficulty == "hard"
                    ? "困难"
                    : "普通";
            difficulty.RegisterValueChangedCallback(change =>
            {
                var id = change.newValue == "简单"
                    ? "easy"
                    : change.newValue == "困难"
                        ? "hard"
                        : "normal";
                difficultyChanged?.Invoke(id);
            });

            list.Clear();
            foreach (var chapter in catalog.Chapters)
            {
                var title = new Label(
                    $"第 {chapter.Id} 章 · {chapter.Name}");
                title.AddToClassList("section-title");
                list.Add(title);
                var row = new VisualElement();
                row.AddToClassList("level-row");
                foreach (var level in chapter.Levels)
                {
                    var captured = level;
                    var button = new Button(() => selected?.Invoke(captured))
                    {
                        text = $"{level.Id}\n{level.Name}",
                        name = $"level-{level.Chapter}-{level.Id}",
                        tooltip =
                            $"第 {level.Chapter} 章第 {level.Id} 关，{level.Name}"
                    };
                    button.AddToClassList("level-button");
                    var state = FindStatus(
                        status,
                        level.Chapter,
                        level.Id);
                    if (state != null)
                    {
                        var stars = Math.Max(0, Math.Min(3, state.stars));
                        var rating =
                            $"{new string('★', stars)}{new string('☆', 3 - stars)}";
                        if (!state.unlocked)
                        {
                            button.text =
                                $"{level.Id}\n{level.Name}\n完成前一关后解锁";
                            button.tooltip =
                                $"第 {level.Chapter} 章第 {level.Id} 关，完成前一关后解锁";
                        }
                        else if (state.completed)
                        {
                            button.text =
                                $"{level.Id}\n{level.Name}\n{rating} · 已完成";
                        }
                        else
                        {
                            button.text =
                                $"{level.Id}\n{level.Name}\n{rating}";
                        }
                        button.SetEnabled(state.unlocked);
                    }
                    if (IsRecommended(journey, level))
                    {
                        if (!button.text.Contains("推荐"))
                            button.text += "\n推荐";
                        button.AddToClassList("recommended-level");
                        button.tooltip += "，推荐下一步学习";
                    }
                    row.Add(button);
                }
                list.Add(row);
            }
        }

        private static void RenderJourneySummary(
            VisualElement view,
            LearningJourneyPlan journey)
        {
            var progress = view.Q<Label>("level-progress-label");
            var recommendation =
                view.Q<Label>("level-recommendation-label");
            if (progress != null)
            {
                progress.text = journey?.HasReliableProgress == true
                    ? $"已完成 {journey.CompletedLevels} / {journey.TotalLevels} 关"
                    : "学习进度暂不可用";
            }
            if (recommendation != null)
            {
                var level = journey?.RecommendedLevel;
                recommendation.text = level == null
                    ? "推荐路径准备中"
                    : $"推荐：第 {level.Chapter} 章 · 第 {level.Id} 关";
            }
        }

        private static bool IsRecommended(
            LearningJourneyPlan journey,
            LevelDefinition level)
        {
            return journey?.RecommendedLevel != null &&
                   journey.RecommendedLevel.Chapter == level.Chapter &&
                   journey.RecommendedLevel.Id == level.Id;
        }

        private static LevelStatusDto FindStatus(
            LevelsStatusDto status,
            int chapter,
            int level)
        {
            if (status?.chapters == null)
                return null;
            foreach (var chapterStatus in status.chapters)
            {
                if (chapterStatus.id != chapter ||
                    chapterStatus.levels == null)
                    continue;
                foreach (var levelStatus in chapterStatus.levels)
                {
                    if (levelStatus.id == level)
                        return levelStatus;
                }
            }

            return null;
        }
    }
}
