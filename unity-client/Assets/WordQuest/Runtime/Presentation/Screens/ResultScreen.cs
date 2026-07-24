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
            Action reports)
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
            view.Q<Label>("result-settlement-status").text =
                SettlementStatus(result);
            view.Q<Button>("replay-button").clicked += () => replay?.Invoke();
            view.Q<Button>("result-home-button").clicked += () => home?.Invoke();
            view.Q<Button>("result-reports-button").clicked += () => reports?.Invoke();
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
