using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class CharacterScreen
    {
        public CharacterScreen(
            VisualElement view,
            IGameService game,
            CancellationToken token,
            Action<int> selected)
        {
            var list = view?.Q<VisualElement>("character-list") ??
                       throw new ArgumentNullException(nameof(view));
            foreach (var character in CharacterCatalog.All)
            {
                var captured = character;
                Button button = null;
                button = new Button(async () =>
                {
                    button.SetEnabled(false);
                    var result = await game.UpdateCharacterAsync(
                        captured.Index,
                        token);
                    button.SetEnabled(true);
                    if (result.IsSuccess)
                        selected?.Invoke(captured.Index);
                })
                {
                    text = $"{character.Name}\n{character.Description}"
                };
                button.AddToClassList("feature-button");
                list.Add(button);
            }
        }
    }
}
