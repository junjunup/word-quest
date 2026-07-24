using System;
using UnityEngine.UIElements;
using WordQuest.Content;

namespace WordQuest.Presentation.Screens
{
    public sealed class LevelSelectScreen
    {
        public LevelSelectScreen(
            VisualElement view,
            ContentCatalog catalog,
            Action<LevelDefinition> selected)
        {
            if (view == null)
                throw new ArgumentNullException(nameof(view));
            if (catalog == null)
                throw new ArgumentNullException(nameof(catalog));

            var list = view.Q<ScrollView>("level-list");
            if (list == null)
                return;

            list.Clear();
            foreach (var chapter in catalog.Chapters)
            {
                var title = new Label(
                    $"第 {chapter.Id} 章 · {chapter.Name}");
                title.AddToClassList("section-title");
                list.Add(title);
                var row = new VisualElement();
                row.AddToClassList("level-row");
                foreach (var level in chapter.Levels)
                {
                    var captured = level;
                    var button = new Button(() => selected?.Invoke(captured))
                    {
                        text = $"{level.Id}\n{level.Name}"
                    };
                    button.AddToClassList("level-button");
                    row.Add(button);
                }
                list.Add(row);
            }
        }
    }
}
