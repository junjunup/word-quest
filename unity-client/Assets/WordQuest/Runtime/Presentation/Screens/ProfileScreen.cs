using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Domain.Game;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class ProfileScreen
    {
        private static readonly Regex TimePattern =
            new Regex("^([01]\\d|2[0-3]):[0-5]\\d$");
        private readonly VisualElement view;
        private readonly IAuthService auth;
        private readonly IGameService game;
        private readonly CancellationToken token;

        public ProfileScreen(
            VisualElement view,
            IAuthService auth,
            IGameService game,
            CancellationToken token,
            Action character,
            Action leaderboard)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.auth = auth ?? throw new ArgumentNullException(nameof(auth));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.token = token;
            view.Q<Button>("save-reminder-button").clicked += SaveReminder;
            view.Q<Button>("choose-character-button").clicked += () =>
                character?.Invoke();
            view.Q<Button>("open-leaderboard-button").clicked += () =>
                leaderboard?.Invoke();
            Load();
        }

        private async void Load()
        {
            var userTask = auth.GetCurrentUserAsync(token);
            var achievementsTask = game.GetAchievementsAsync(token);
            var endlessTask = game.GetEndlessBestAsync(token);
            await System.Threading.Tasks.Task.WhenAll(
                userTask,
                achievementsTask,
                endlessTask);

            var user = await userTask;
            if (user.IsSuccess)
            {
                view.Q<Label>("profile-name-label").text =
                    user.Data.nickname ?? user.Data.username;
                view.Q<Label>("profile-stats-label").text =
                    $"等级 {user.Data.level} · 经验 {user.Data.totalExp} · 总分 {user.Data.totalScore}";
                view.Q<TextField>("reminder-time-field").value =
                    user.Data.reminderSettings?.time ?? "20:00";
                view.Q<Toggle>("reminder-enabled-toggle").value =
                    user.Data.reminderSettings?.enabled ?? false;
            }

            var achievements = await achievementsTask;
            var unlockedIds = new HashSet<string>(
                StringComparer.Ordinal);
            foreach (var achievement in achievements.Data ??
                                        Array.Empty<AchievementDto>())
            {
                if (!string.IsNullOrWhiteSpace(achievement.id))
                    unlockedIds.Add(achievement.id);
            }
            view.Q<Label>("profile-achievement-label").text =
                $"已解锁 {unlockedIds.Count} / {AchievementPolicy.All.Count} 项成就";
            var achievementList =
                view.Q<ScrollView>("profile-achievement-list");
            achievementList.Clear();
            foreach (var definition in AchievementPolicy.All)
            {
                var unlocked = unlockedIds.Contains(definition.Id);
                var row = new Label(
                    $"{(unlocked ? definition.Icon : "🔒")} " +
                    $"{definition.Name}\n{definition.Description}");
                row.AddToClassList("list-card");
                row.AddToClassList(
                    unlocked
                        ? "achievement-unlocked"
                        : "achievement-locked");
                row.style.opacity = unlocked ? 1f : 0.55f;
                achievementList.Add(row);
            }
            var endless = await endlessTask;
            view.Q<Label>("profile-endless-label").text =
                endless.IsSuccess
                    ? $"无尽最佳 {endless.Data.bestScore} · 连胜 {endless.Data.bestStreak}"
                    : "无尽成绩暂不可用";
        }

        private async void SaveReminder()
        {
            var time = view.Q<TextField>("reminder-time-field").value?.Trim();
            var status = view.Q<Label>("profile-status-label");
            if (!TimePattern.IsMatch(time ?? string.Empty))
            {
                status.text = "提醒时间必须是 HH:mm";
                return;
            }

            var result = await auth.UpdateReminderAsync(
                view.Q<Toggle>("reminder-enabled-toggle").value,
                time,
                token);
            status.text = result.IsSuccess ? "提醒设置已保存" : result.Message;
        }
    }
}
