using NUnit.Framework;
using UnityEngine.UIElements;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class ScreenRouterTests
    {
        [Test]
        public void Constructor_never_exposes_an_empty_content_shell()
        {
            var root = new VisualElement();

            _ = new ScreenRouter(root);

            var content = root.Q<VisualElement>("screen-content");
            Assert.That(content, Is.Not.Null);
            Assert.That(content.childCount, Is.EqualTo(1));
            Assert.That(
                content[0].Q<Label>("status-label")?.text,
                Does.Contain("正在"));
        }
    }
}
