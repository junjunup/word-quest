using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Social;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class LeaderboardScreen
    {
        private readonly VisualElement view;
        private readonly IGameService game;
        private readonly string currentUserId;
        private readonly CancellationToken token;

        public LeaderboardScreen(
            VisualElement view,
            IGameService game,
            string currentUserId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.currentUserId = currentUserId;
            this.token = token;
            view.Q<Button>("total-ranking-button").clicked += () => Load("total");
            view.Q<Button>("exp-ranking-button").clicked += () => Load("exp");
            Load("total");
        }

        private async void Load(string type)
        {
            var result = await game.GetLeaderboardAsync(type, token);
            var list = view.Q<ScrollView>("leaderboard-list");
            list.Clear();
            var rank = 0;
            foreach (var user in result.Data ??
                                 Array.Empty<LeaderboardEntryDto>())
            {
                rank++;
                var row = new Label(
                    $"{rank}. {user.nickname} · Lv.{user.level} · 总分 {user.totalScore} · 经验 {user.totalExp}");
                row.AddToClassList("list-card");
                if (SocialProjection.IsCurrentUser(
                        currentUserId,
                        user._id))
                    row.AddToClassList("current-user-row");
                list.Add(row);
            }
            if (rank == 0)
                list.Add(new Label(result.IsSuccess ? "暂无排行数据" : result.Message));
        }
    }
}
