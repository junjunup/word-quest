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
                result.Stars == 0 ? "继续积累，下一次会更好" : "关卡完成";
            view.Q<Label>("stars-label").text =
                new string('★', result.Stars) +
                new string('☆', 3 - result.Stars);
            view.Q<Label>("result-summary").text =
                $"得分 {result.Score}  ·  正确率 {result.CorrectRate}%  ·  最大连击 {result.MaximumCombo}";
            view.Q<Button>("replay-button").clicked += () => replay?.Invoke();
            view.Q<Button>("result-home-button").clicked += () => home?.Invoke();
            view.Q<Button>("result-reports-button").clicked += () => reports?.Invoke();
        }
    }
}
