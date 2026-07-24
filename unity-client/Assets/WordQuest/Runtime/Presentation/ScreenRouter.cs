using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace WordQuest.Presentation
{
    public enum ScreenId
    {
        Login,
        Home,
        LevelSelect,
        Game,
        Result,
        Endless,
        Review,
        DailyChallenge,
        Reports,
        Vocabulary,
        Pronunciation,
        Profile,
        Leaderboard,
        Social,
        Challenge,
        Character,
        AiTutor
    }

    public sealed class ScreenRouter
    {
        private readonly VisualElement root;
        private readonly VisualElement content;
        private readonly Dictionary<ScreenId, VisualElement> cache =
            new Dictionary<ScreenId, VisualElement>();

        public ScreenRouter(VisualElement root)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            BuildShell();
            content = root.Q<VisualElement>("screen-content");
        }

        public ScreenId Current { get; private set; }
        public VisualElement CurrentView { get; private set; }

        public event Action<ScreenId> ScreenRequested;

        public VisualElement Show(ScreenId screen)
        {
            content.Clear();
            if (!cache.TryGetValue(screen, out var view))
            {
                view = CreateView(screen);
                cache[screen] = view;
            }

            Current = screen;
            CurrentView = view;
            content.Add(view);
            var navigation = root.Q<VisualElement>("navigation");
            navigation.style.display =
                screen == ScreenId.Login ? DisplayStyle.None : DisplayStyle.Flex;
            return view;
        }

        public void Refresh(ScreenId screen)
        {
            cache.Remove(screen);
            if (Current == screen)
                Show(screen);
        }

        private void BuildShell()
        {
            root.Clear();
            root.AddToClassList("app-root");

            var navigation = new VisualElement { name = "navigation" };
            navigation.AddToClassList("navigation");
            var brand = new Label("WORD QUEST");
            brand.AddToClassList("brand");
            navigation.Add(brand);

            AddNavigationButton(navigation, "主页", ScreenId.Home);
            AddNavigationButton(navigation, "冒险", ScreenId.LevelSelect);
            AddNavigationButton(navigation, "复习", ScreenId.Review);
            AddNavigationButton(navigation, "报告", ScreenId.Reports);
            AddNavigationButton(navigation, "社交", ScreenId.Social);
            AddNavigationButton(navigation, "AI 导师", ScreenId.AiTutor);
            root.Add(navigation);

            var content = new VisualElement { name = "screen-content" };
            content.AddToClassList("screen-content");
            root.Add(content);

            var tokens = Resources.Load<StyleSheet>("UI/Styles/Tokens");
            var appStyle = Resources.Load<StyleSheet>("UI/Styles/App");
            if (tokens != null)
                root.styleSheets.Add(tokens);
            if (appStyle != null)
                root.styleSheets.Add(appStyle);
        }

        private void AddNavigationButton(
            VisualElement navigation,
            string text,
            ScreenId screen)
        {
            var button = new Button(() => ScreenRequested?.Invoke(screen))
            {
                text = text,
                name = $"nav-{screen.ToString().ToLowerInvariant()}"
            };
            button.AddToClassList("nav-button");
            navigation.Add(button);
        }

        private VisualElement CreateView(ScreenId screen)
        {
            var asset = Resources.Load<VisualTreeAsset>(
                $"UI/Screens/{screen}");
            if (asset != null)
            {
                var cloned = asset.CloneTree();
                cloned.AddToClassList("screen");
                return cloned;
            }

            return CreateFallback(screen);
        }

        private static VisualElement CreateFallback(ScreenId screen)
        {
            var view = new VisualElement { name = $"{screen}-screen" };
            view.AddToClassList("screen");
            view.Add(new Label(screen.ToString()) { name = "screen-title" });
            view.Add(new Label("该功能正在载入") { name = "status-label" });
            return view;
        }
    }
}
