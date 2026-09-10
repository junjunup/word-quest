using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation
{
    public sealed partial class WordQuestApp
    {
        private IDailyLearningService dailyLearning;
        private bool dailyLoading;
        private bool switchingWordbook;

        private async Task FlushQuizAnswersAsync(string userId, CancellationToken token)
        {
            try { await PendingQuizSync.FlushAsync(pendingSync, Learning, userId, token); }
            catch (OperationCanceledException) { }
            catch (Exception) { /* The durable queue retains unanswered requests. */ }
        }

        private async Task ShowDailyLearningAsync()
        {
            if (dailyLoading) return;
            dailyLoading = true;
            var view = router.CurrentView;
            var token = SessionToken;
            var user = Context.User?.Id;
            var book = Context.Settings.WordbookId;
            var panel = LearningPanel(view, "正在准备今日学习…");
            try
            {
                await FlushQuizAnswersAsync(user, token);
                var response = await dailyLearning.CreateAsync(book, token);
                if (token.IsCancellationRequested || router.CurrentView != view) return;
                panel.RemoveFromHierarchy();
                if (response.IsSuccess && response.Data != null) ShowDailyPanel(response.Data);
                else ShowLearningError(view, response.Message);
            }
            catch (OperationCanceledException) { panel.RemoveFromHierarchy(); }
            catch (Exception) { if (router.CurrentView == view) { panel.RemoveFromHierarchy(); ShowLearningError(view, "暂时无法读取今日学习，请重试。"); } }
            finally { dailyLoading = false; }
        }

        private void ShowLearningError(VisualElement view, string message)
        {
            var panel = LearningPanel(view, message);
            panel.Add(new Button(() => { panel.RemoveFromHierarchy(); _ = ShowDailyLearningAsync(); }) { text = "重新连接" });
            panel.Add(new Button(() => panel.RemoveFromHierarchy()) { text = "返回主页" });
        }

        private void ShowDailyPanel(DailyLearningSessionDto session)
        {
            var view = router.CurrentView;
            var token = SessionToken;
            var remaining = DailyLearningPlan.Remaining(session);
            var items = session.items ?? Array.Empty<WordDto>();
            var done = (session.completedWordIds ?? Array.Empty<string>()).Length;
            var ended = session.status == "completed" || session.status == "ended";
            var panel = LearningPanel(router.CurrentView,
                session.status == "completed" ? "本轮学习已完成" : session.isPreviousDay ? $"继续 {session.dateKey} 的学习" : "今日学习");
            panel.Add(new Label($"{session.wordbookId} · 本轮 {items.Length} 词 · 首答与反馈已完成 {done}/{items.Length}"));
            panel.Add(new Label($"新词 {items.Count(x => x.kind == "new")} · 到期复习 {items.Count(x => x.kind == "review")} · 剩余 {remaining.Length}"));
            if (items.Length == 0)
                panel.Add(new Label("当前词书没有新词或到期复习词。可以查看词库或稍后再来。"));
            else if (ended)
            {
                panel.Add(new Label($"无提示首答精确回忆正确 {session.independentCorrect} 词。完成本轮不代表长期记住。"));
                var rows = new ScrollView();
                rows.style.maxHeight = 220;
                foreach (var word in session.reviewWords ?? Array.Empty<DailyReviewWordDto>())
                    rows.Add(new Label($"待巩固：{word.word} · 下次复习 {ReviewDate(word.nextReviewAt)}"));
                if ((session.reviewWords?.Length ?? 0) == 0) rows.Add(new Label("本轮没有首答错误或提示作答的词。继续按计划复习。"));
                panel.Add(rows);
            }
            else if ((session.pendingFeedback?.Length ?? 0) > 0)
            {
                var feedback = session.pendingFeedback[0];
                var word = items.First(x => x._id == feedback.wordId);
                panel.Add(new Label("上次首答已保存，先确认反馈再继续。"));
                panel.Add(new Label($"{word.word} · {word.meaning} · {(feedback.isCorrect ? "首答正确" : "首答待巩固")}"));
                panel.Add(new Label($"你的答案：{feedback.playerAnswer}"));
                if (!string.IsNullOrWhiteSpace(word.example)) panel.Add(new Label(word.example));
                if (!string.IsNullOrWhiteSpace(word.exampleTranslation)) panel.Add(new Label(word.exampleTranslation));
                panel.Add(new Button(async () =>
                {
                    panel.SetEnabled(false);
                    var response = await dailyLearning.AcknowledgeAsync(session.sessionId, word._id, token);
                    if (token.IsCancellationRequested || view != router.CurrentView) return;
                    panel.SetEnabled(true);
                    if (!response.IsSuccess) { panel.Add(new Label(response.Message)); return; }
                    panel.RemoveFromHierarchy();
                    ShowDailyPanel(response.Data);
                }) { text = feedback.isCorrect ? "已看反馈，继续" : "已看讲解，加入稍后复习" });
            }
            else if (remaining.Length > 0)
            {
                panel.Add(new Button(() =>
                {
                    panel.RemoveFromHierarchy();
                    StartLevel(new LevelSelection(new LevelDefinition(1, 1, "今日学习", remaining.Length,
                        "daily", "", null, false), Difficulty.For(DifficultyKind.Normal), session.wordbookId), session);
                }) { text = session.isPreviousDay ? "继续上一轮" : done > 0 ? "继续本轮学习" : "开始本轮学习" });
                if (session.isPreviousDay)
                    panel.Add(new Button(async () =>
                    {
                        panel.SetEnabled(false);
                        var result = await dailyLearning.EndAsync(session.sessionId, token);
                        if (token.IsCancellationRequested || view != router.CurrentView) return;
                        panel.SetEnabled(true);
                        if (!result.IsSuccess) { panel.Add(new Label(result.Message)); return; }
                        panel.RemoveFromHierarchy();
                        await ShowDailyLearningAsync();
                    }) { text = "结束上一轮，准备今天的学习" });
            }
            panel.Add(new Button(() => { panel.RemoveFromHierarchy(); Navigate(ScreenId.Reports); }) { text = "查看学习证据" });
            panel.Add(new Button(() => panel.RemoveFromHierarchy()) { text = "返回主页" });
        }

        private async void SelectWordbook(string wordbookId)
        {
            if (switchingWordbook || wordbookId == Context.Settings.WordbookId) return;
            switchingWordbook = true;
            var view = router.CurrentView;
            var token = SessionToken;
            try
            {
                await FlushQuizAnswersAsync(Context.User?.Id, token);
                var active = await dailyLearning.CurrentAsync(Context.Settings.WordbookId, token);
                if (token.IsCancellationRequested || view != router.CurrentView) return;
                if (!active.IsSuccess) { var error = LearningPanel(view, "无法核对本轮进度，词书尚未切换，请重试。"); error.Add(new Button(() => error.RemoveFromHierarchy()) { text = "知道了" }); return; }
                if (active.Data?.status != "active") { CompleteWordbookSwitch(wordbookId); return; }
                var panel = LearningPanel(view, "当前词书还有未完成的今日学习");
                panel.Add(new Label("切换会结束当前轮，已保存的学习记录会保留。"));
                panel.Add(new Button(async () =>
                {
                    panel.SetEnabled(false);
                    var ended = await dailyLearning.EndAsync(active.Data.sessionId, token);
                    panel.SetEnabled(true);
                    if (token.IsCancellationRequested || view != router.CurrentView) return;
                    if (!ended.IsSuccess) { panel.Add(new Label(ended.Message)); return; }
                    panel.RemoveFromHierarchy();
                    CompleteWordbookSwitch(wordbookId);
                }) { text = "结束当前轮并切换" });
                panel.Add(new Button(() => panel.RemoveFromHierarchy()) { text = "保留当前词书" });
            }
            catch (OperationCanceledException) { }
            finally { switchingWordbook = false; }
        }

        private void CompleteWordbookSwitch(string wordbookId)
        {
            ApplyWordbook(wordbookId);
            if (router.Current == ScreenId.LevelSelect) _ = ShowLevelSelect();
            else if (router.Current == ScreenId.Vocabulary) ShowVocabulary();
        }

        internal static string ReviewDate(string value) => DateTimeOffset.TryParse(value, out var date)
            ? date.ToOffset(TimeSpan.FromHours(8)).ToString("MM-dd HH:mm") + "（北京时间）" : "等待计划更新";

        private static VisualElement LearningPanel(VisualElement view, string title)
        {
            view.Q<VisualElement>("daily-learning-panel")?.RemoveFromHierarchy();
            var panel = new ScrollView { name = "daily-learning-panel" };
            panel.AddToClassList("list-card");
            panel.style.position = Position.Absolute;
            panel.style.left = new Length(10, LengthUnit.Percent);
            panel.style.right = new Length(10, LengthUnit.Percent);
            panel.style.top = new Length(12, LengthUnit.Percent);
            panel.style.bottom = new Length(12, LengthUnit.Percent);
            panel.style.backgroundColor = new Color(1f, 0.98f, 0.92f, 1);
            panel.style.paddingTop = panel.style.paddingBottom = panel.style.paddingLeft = panel.style.paddingRight = 24;
            var heading = new Label(title);
            heading.AddToClassList("question-title");
            panel.Add(heading);
            view.Add(panel);
            return panel;
        }
    }
}
