using System;
using UnityEngine.UIElements;
using WordQuest.Domain.Game;

namespace WordQuest.Presentation.Screens
{
    public sealed class HudScreen
    {
        private readonly VisualElement root;

        public HudScreen(VisualElement root, Action pause)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            root.Q<Button>("pause-button").clicked += () => pause?.Invoke();
        }

        public void Render(GameSessionSnapshot snapshot)
        {
            if (snapshot == null)
                return;

            root.Q<Label>("lives-label").text =
                $"生命 {snapshot.Lives}/{snapshot.MaximumLives}";
            root.Q<Label>("score-label").text = $"分数 {snapshot.Score}";
            root.Q<Label>("combo-label").text =
                snapshot.Combo > 0 ? $"连击 ×{snapshot.Combo}" : "保持专注";
            var progress = root.Q<ProgressBar>("level-progress");
            progress.value = snapshot.ProgressPercent;
            progress.title =
                $"{snapshot.AnsweredCount}/{snapshot.WordCount}";
        }
    }
}
