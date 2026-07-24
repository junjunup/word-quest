using System;
using UnityEngine.UIElements;
using WordQuest.Gameplay;

namespace WordQuest.Presentation.Screens
{
    public sealed class TutorialOverlay : IDisposable
    {
        private readonly VisualElement root;
        private readonly TutorialController controller;

        public TutorialOverlay(
            VisualElement root,
            TutorialController controller)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            controller.StepChanged += Render;
            root.Q<Button>("tutorial-skip-button").clicked += controller.Skip;
            Render(controller.Step);
        }

        public void Dispose()
        {
            controller.StepChanged -= Render;
        }

        private void Render(TutorialStep step)
        {
            root.style.display =
                step == TutorialStep.Complete
                    ? DisplayStyle.None
                    : DisplayStyle.Flex;
            var label = root.Q<Label>("tutorial-label");
            switch (step)
            {
                case TutorialStep.Move:
                    label.text = "使用 WASD、方向键或手柄左摇杆移动。";
                    break;
                case TutorialStep.Interact:
                    label.text = "靠近地图角色或怪物，触发词汇挑战。";
                    break;
                case TutorialStep.Answer:
                    label.text = "选择或输入答案；连续错误时系统会降低难度。";
                    break;
                default:
                    label.text = "引导完成，开始你的单词冒险！";
                    break;
            }
        }
    }
}
