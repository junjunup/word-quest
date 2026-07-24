using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Social;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class SocialScreen
    {
        private readonly VisualElement view;
        private readonly SocialController controller;
        private readonly string wordbookId;
        private readonly CancellationToken token;
        private readonly Action<string> openChallenge;

        public SocialScreen(
            VisualElement view,
            SocialController controller,
            string wordbookId,
            CancellationToken token,
            Action<string> openChallenge)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.wordbookId = wordbookId;
            this.token = token;
            this.openChallenge = openChallenge;
            view.Q<Button>("social-refresh-button").clicked += Refresh;
            view.Q<Button>("user-search-button").clicked += Search;
            Refresh();
        }

        private async void Refresh()
        {
            var model = await controller.RefreshAsync(token);
            var list = view.Q<ScrollView>("friend-list");
            list.Clear();

            foreach (var request in model.Incoming)
            {
                var row = Card(
                    $"好友请求：{Name(request.friend)}",
                    "接受",
                    () => Respond(request.id, true),
                    "拒绝",
                    () => Respond(request.id, false));
                list.Add(row);
            }
            foreach (var request in model.Outgoing)
                list.Add(Card($"等待 {Name(request.friend)} 接受"));
            foreach (var friend in model.Friends)
            {
                var friendId = friend.friend?.id;
                list.Add(Card(
                    $"{Name(friend.friend)} · Lv.{friend.friend?.level ?? 0}",
                    "发起 PK",
                    () => CreateChallenge(friendId),
                    "删除好友",
                    () => DeleteFriend(friend.id)));
            }

            var challenges = view.Q<ScrollView>("challenge-list");
            challenges.Clear();
            foreach (var challenge in model.Challenges)
            {
                var captured = challenge;
                challenges.Add(Card(
                    $"{Name(challenge.challenger)} vs {Name(challenge.opponent)} · {challenge.status}",
                    "查看",
                    () => openChallenge?.Invoke(captured.id)));
            }

            view.Q<Label>("social-status-label").text =
                string.Join("；", model.Warnings);
        }

        private async void Search()
        {
            var query = view.Q<TextField>("user-search-field").value;
            var result = await controller.SearchUsersAsync(query, token);
            var list = view.Q<ScrollView>("user-search-results");
            list.Clear();
            foreach (var user in result.Data ?? Array.Empty<PublicUserDto>())
            {
                var captured = user;
                list.Add(Card(
                    $"{Name(user)} · Lv.{user.level}",
                    "添加好友",
                    () => SendRequest(captured.id)));
            }
        }

        private async void SendRequest(string userId)
        {
            var result = await controller.SendFriendRequestAsync(userId, token);
            Status(result.IsSuccess ? "好友请求已发送" : result.Message);
            Refresh();
        }

        private async void Respond(string id, bool accept)
        {
            var result = await controller.RespondAsync(id, accept, token);
            Status(result.IsSuccess ? "好友请求已处理" : result.Message);
            Refresh();
        }

        private async void CreateChallenge(string opponentId)
        {
            var result = await controller.CreateChallengeAsync(
                opponentId,
                wordbookId,
                view.Q<IntegerField>("pk-question-count-field").value,
                token);
            Status(result.IsSuccess ? "PK 已创建" : result.Message);
            Refresh();
        }

        private async void DeleteFriend(string id)
        {
            var result = await controller.DeleteAsync(id, token);
            Status(result.IsSuccess ? "好友关系已删除" : result.Message);
            Refresh();
        }

        private void Status(string text)
        {
            view.Q<Label>("social-status-label").text = text;
        }

        private static VisualElement Card(
            string text,
            string firstLabel = null,
            Action first = null,
            string secondLabel = null,
            Action second = null)
        {
            var row = new VisualElement();
            row.AddToClassList("list-card");
            row.Add(new Label(text));
            if (!string.IsNullOrEmpty(firstLabel))
                row.Add(new Button(() => first?.Invoke()) { text = firstLabel });
            if (!string.IsNullOrEmpty(secondLabel))
                row.Add(new Button(() => second?.Invoke()) { text = secondLabel });
            return row;
        }

        private static string Name(PublicUserDto user)
        {
            if (user == null)
                return "未知玩家";
            return string.IsNullOrWhiteSpace(user.nickname)
                ? user.username
                : user.nickname;
        }
    }
}
