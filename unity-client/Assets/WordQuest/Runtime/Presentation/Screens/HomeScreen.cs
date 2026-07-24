using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class HomeScreen
    {
        public HomeScreen(
            VisualElement view,
            WordQuestContext context,
            Action<ScreenId> navigate,
            IGameService game = null,
            CancellationToken token = default)
        {
            if (view == null)
                throw new ArgumentNullException(nameof(view));
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var greeting = view.Q<Label>("greeting-label");
            if (greeting != null)
            {
                greeting.text =
                    $"欢迎回来，{context.User?.Username ?? "冒险者"}";
            }

            foreach (var button in view.Query<Button>(
                         className: "feature-button").ToList())
            {
                if (!Enum.TryParse(button.viewDataKey, out ScreenId screen))
                    continue;
                button.clicked += () => navigate?.Invoke(screen);
            }

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
                        status.text =
                            $"获得 {result.Data.reward} 经验，连续学习 {result.Data.loginStreak} 天";
                    }
                    else
                    {
                        status.text = result.Message;
                        reward.SetEnabled(true);
                    }
                };
            }
        }
    }
}
