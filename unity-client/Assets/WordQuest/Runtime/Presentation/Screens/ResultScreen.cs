using System;
using UnityEngine.UIElements;
using WordQuest.Domain.Game;

namespace WordQuest.Presentation.Screens
{
    public sealed class ResultScreen
    {
        public ResultScreen(
            VisualElement view,
            LevelResult result,
            Action replay,
            Action home,
            Action reports,
            Action next = null,
            Action levelMap = null)
        {
            if (view == null)
                throw new ArgumentNullException(nameof(view));
            if (result == null)
                throw new ArgumentNullException(nameof(result));

            view.Q<Label>("result-title").text =
                result.LevelCompleted
                    ? "关卡完成"
                    : "挑战结束，整装后再出发";
            view.Q<Label>("stars-label").text =
                new string('★', result.Stars) +
                new string('☆', 3 - result.Stars);
            view.Q<Label>("result-summary").text =
                $"得分 {result.Score}  ·  正确率 {result.CorrectRate}%  ·  最大连击 {result.MaximumCombo}";
            view.Q<Label>("result-learning-summary").text =
                $"答对 {result.CorrectCount} 题  ·  错题 {result.WrongCount} 题  ·  用时 {FormatTime(result.TotalTimeMs)}";
            view.Q<Label>("result-learning-cue").text =
                LearningCue(result);
            view.Q<Label>("result-settlement-status").text =
                SettlementStatus(result);

            var canProgress =
                result.LevelCompleted &&
                (result.ProgressSaved || result.ProgressPending);
            var primary = view.Q<Button>("result-primary-button");
            var replayButton = view.Q<Button>("replay-button");
            if (canProgress && next != null)
            {
                primary.text = "进入下一关";
                primary.clicked += () => next();
                replayButton.style.display = DisplayStyle.Flex;
            }
            else if (canProgress)
            {
                primary.text = "返回关卡地图";
                primary.clicked += () => (levelMap ?? home)?.Invoke();
                replayButton.style.display = DisplayStyle.Flex;
            }
            else
            {
                primary.text = "再试一次";
                primary.clicked += () => replay?.Invoke();
                replayButton.style.display = DisplayStyle.None;
            }

            replayButton.clicked += () => replay?.Invoke();
            view.Q<Button>("result-home-button").clicked +=
                () => home?.Invoke();
            view.Q<Button>("result-reports-button").clicked +=
                () => reports?.Invoke();
        }

        private static string FormatTime(long totalTimeMs)
        {
            var seconds = Math.Max(0, totalTimeMs / 1000);
            return seconds < 60
                ? $"{seconds} 秒"
                : $"{seconds / 60} 分 {seconds % 60} 秒";
        }

        private static string LearningCue(LevelResult result)
        {
            if (!result.LevelCompleted)
                return "先稳住节奏，留意刚才的错题，再试一次就会更好。";
            if (result.CorrectRate >= 90)
                return "本轮答题表现很好，之后通过延迟复习检验记忆。";
            if (result.CorrectRate >= 70)
                return "本轮答题表现不错，继续巩固易错词。";
            return "已经完成挑战，建议稍后复习本关错词。";
        }

        private static string SettlementStatus(LevelResult result)
        {
            if (!result.LevelCompleted)
                return "本次未通关，关卡进度未推进。";
            if (result.ProgressSaved)
                return "通关进度与成就条件已同步。";
            if (result.ProgressPending)
                return "网络暂不可用，通关进度已安全加入当前账号的待同步队列。";
            return "服务器未接受本次进度；未推进关卡，也未发放通关成就。";
        }
    }
}
