using System;
using UnityEngine.UIElements;

namespace WordQuest.Presentation.Screens
{
    public sealed class PauseOverlay
    {
        private readonly VisualElement root;

        public PauseOverlay(
            VisualElement root,
            Action resume,
            Action toggleMute,
            Action home,
            Action logout)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            root.Q<Button>("resume-button").clicked += () => resume?.Invoke();
            root.Q<Button>("mute-button").clicked += () => toggleMute?.Invoke();
            root.Q<Button>("pause-home-button").clicked += () => home?.Invoke();
            root.Q<Button>("pause-logout-button").clicked += () => logout?.Invoke();
            root.style.display = DisplayStyle.None;
        }

        public void SetVisible(bool visible)
        {
            root.style.display =
                visible ? DisplayStyle.Flex : DisplayStyle.None;
            if (visible)
                root.Q<Button>("resume-button").Focus();
        }
    }
}
