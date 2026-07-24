using System;
using UnityEngine.UIElements;
using WordQuest.Domain.Game;

namespace WordQuest.Presentation
{
    public sealed class AchievementToast
    {
        private readonly VisualElement root;

        public AchievementToast(VisualElement root)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            root.style.display = DisplayStyle.None;
        }

        public void Show(Achievement achievement)
        {
            if (achievement == null)
                return;

            root.Q<Label>("achievement-title").text =
                $"解锁成就 · {achievement.Name}";
            root.Q<Label>("achievement-description").text =
                achievement.Description;
            root.style.display = DisplayStyle.Flex;
            root.schedule.Execute(() =>
                    root.style.display = DisplayStyle.None)
                .StartingIn(3500);
        }
    }
}
