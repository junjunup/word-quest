using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class HomeScreen
    {
        private readonly Action<LevelDefinition> startLevel;
        private readonly Action<ScreenId> navigate;
        private readonly VisualElement view;
        private LearningJourneyPlan journey;

        public HomeScreen(
            VisualElement view,
            WordQuestContext context,
            Action<ScreenId> navigate,
            IGameService game = null,
            ILearningService learning = null,
            CancellationToken token = default,
            LearningJourneyPlan journey = null,
            Action<LevelDefinition> startLevel = null)
        {
            if (view == null)
                throw new ArgumentNullException(nameof(view));
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            this.view = view;
            this.navigate = navigate;
            this.startLevel = startLevel;

            var greeting = view.Q<Label>("greeting-label");
            if (greeting != null)
            {
                greeting.text =
                    $"欢迎回来，{context.User?.Username ?? "小冒险家"}";
            }

            var streak = view.Q<Label>("streak-label");
            if (streak != null)
            {
                streak.text = context.User?.LoginStreak > 0
                    ? $"连续学习 {context.User.LoginStreak} 天"
                    : "今天是新旅程的第 1 天";
            }

            var learningStage = view.Q<Label>("learning-stage-label");
            if (learningStage != null)
            {
                learningStage.text = LearnerStageCatalog.DescribePath(
                    context.Settings.LearnerStageId);
            }

            foreach (var button in view.Query<Button>(
                         className: "feature-button").ToList())
            {
                if (!Enum.TryParse(button.viewDataKey, out ScreenId screen))
                    continue;
                button.clicked += () => navigate?.Invoke(screen);
            }

            var continueLearning =
                view.Q<Button>("continue-learning-button");
            if (continueLearning != null)
            {
                continueLearning.clicked += () =>
                {
                    if (this.journey?.RecommendedLevel != null &&
                        this.startLevel != null)
                    {
                        this.startLevel(this.journey.RecommendedLevel);
                        return;
                    }

                    this.navigate?.Invoke(ScreenId.LevelSelect);
                };
            }
            RenderJourney(journey);

            var reward = view.Q<Button>("daily-reward-button");
            if (reward != null && game != null)
            {
                reward.clicked += async () =>
                {
                    reward.SetEnabled(false);
                    var result = await game.ClaimDailyRewardAsync(token);
                    var status = view.Q<Label>("reward-status-label");
                    if (result.IsSuccess)
                    {
                        if (status != null)
                        {
                            status.text =
                                $"获得 {result.Data.reward} 经验，连续学习 {result.Data.loginStreak} 天";
                            status.RemoveFromClassList("error-status");
                            status.AddToClassList("success-status");
                        }
                    }
                    else
                    {
                        if (status != null)
                        {
                            status.text = result.Message;
                            status.RemoveFromClassList("success-status");
                            status.AddToClassList("error-status");
                        }
                        reward.SetEnabled(true);
                    }
                };
            }

            if (learning != null)
                LoadDailyProgress(view, learning, token);
        }

        public void RenderJourney(LearningJourneyPlan updatedJourney)
        {
            journey = updatedJourney;
            var recommended = updatedJourney?.RecommendedLevel;
            var level = view.Q<Label>("recommended-level-label");
            var meta = view.Q<Label>("recommended-meta-label");
            var progress = view.Q<Label>("journey-progress-label");
            var button = view.Q<Button>("continue-learning-button");

            if (recommended == null)
            {
                if (level != null)
                    level.text = "先到关卡地图选择学习内容";
                if (meta != null)
                    meta.text = "可以随时调整词书和难度";
                if (progress != null)
                    progress.text = "学习进度暂不可用";
                if (button != null)
                    button.text = "打开关卡地图";
                return;
            }

            if (level != null)
            {
                level.text =
                    $"第 {recommended.Chapter} 章 · 第 {recommended.Id} 关";
            }
            if (meta != null)
            {
                var minutes = Math.Max(
                    5,
                    (int)Math.Ceiling(recommended.WordsCount / 4d));
                meta.text =
                    $"{recommended.Name}  ·  {recommended.WordsCount} 个单词  ·  约 {minutes} 分钟";
            }
            if (progress != null)
            {
                progress.text = updatedJourney.HasReliableProgress
                    ? $"学习旅程：已完成 {updatedJourney.CompletedLevels} / {updatedJourney.TotalLevels} 关"
                    : "学习进度暂不可用，将从安全起点继续";
            }
            if (button != null)
                button.text = "继续学习";
        }

        private static async void LoadDailyProgress(
            VisualElement view,
            ILearningService learning,
            CancellationToken token)
        {
            var result = await learning.GetDailyStatsAsync(1, token);
            if (!result.IsSuccess || result.Data == null)
                return;

            var total = 0;
            foreach (var day in result.Data)
                total += Math.Max(0, day.total);
            var progress = view.Q<ProgressBar>("daily-progress");
            if (progress != null)
            {
                progress.value = Math.Min(total, 20);
                progress.title = $"{total} / 20 个单词";
            }
            var daily = view.Q<Label>("daily-progress-label");
            if (daily != null)
            {
                daily.text = total >= 20
                    ? "今日目标已完成，做得漂亮"
                    : $"今天已经学习 {total} 个单词";
            }
        }
    }
}
