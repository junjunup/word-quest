using System;
using UnityEngine.UIElements;
using WordQuest.Application;

namespace WordQuest.Presentation.Screens
{
    public sealed class HomeScreen
    {
        public HomeScreen(
            VisualElement view,
            WordQuestContext context,
            Action<ScreenId> navigate)
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
        }
    }
}
