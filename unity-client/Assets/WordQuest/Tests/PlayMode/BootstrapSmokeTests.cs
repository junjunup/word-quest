using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UIElements;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class BootstrapSmokeTests
    {
        [UnityTest]
        public IEnumerator Boot_creates_single_app_and_ui()
        {
            yield return SceneManager.LoadSceneAsync("Bootstrap");
            yield return null;

            Assert.That(
                Object.FindObjectsByType<WordQuestApp>(),
                Has.Length.EqualTo(1));
            var ui = GameObject.Find("WordQuest UI");
            Assert.That(ui, Is.Not.Null);
            var panelSettings =
                ui.GetComponent<UIDocument>().panelSettings;
            Assert.That(
                panelSettings,
                Is.SameAs(
                    Resources.Load<PanelSettings>(
                        "UI/WordQuestPanelSettings")));
            Assert.That(
                panelSettings.themeStyleSheet,
                Is.Not.Null);
            Assert.That(
                Object.FindAnyObjectByType<AudioListener>(),
                Is.Not.Null);
            var content = ui
                .GetComponent<UIDocument>()
                .rootVisualElement
                .Q<VisualElement>("screen-content");
            Assert.That(content, Is.Not.Null);
            Assert.That(
                content.childCount,
                Is.GreaterThan(0),
                "Bootstrap must never expose an empty application shell.");
        }

        [UnityTest]
        public IEnumerator Login_keyboard_focus_has_a_visible_ring()
        {
            var uiObject = new GameObject("Focus Test UI");
            var document = uiObject.AddComponent<UIDocument>();
            document.panelSettings = Resources.Load<PanelSettings>(
                "UI/WordQuestPanelSettings");
            var router = new ScreenRouter(document.rootVisualElement);
            var view = router.Show(ScreenId.Login);
            yield return null;

            var username = view.Q<TextField>("username-field");
            Assert.That(username, Is.Not.Null);
            username.Focus();
            yield return null;

            var input = username.panel.focusController.focusedElement
                as VisualElement;
            Assert.That(input, Is.Not.Null);
            Assert.That(
                username.Contains(input) || ReferenceEquals(username, input),
                Is.True);
            Assert.That(
                input.resolvedStyle.borderTopWidth,
                Is.GreaterThanOrEqualTo(3f),
                "Keyboard focus must have a persistent visible border.");
            var focusColor = input.resolvedStyle.borderTopColor;
            Assert.That(focusColor.r, Is.EqualTo(232f / 255f).Within(0.005f));
            Assert.That(focusColor.g, Is.EqualTo(177f / 255f).Within(0.005f));
            Assert.That(focusColor.b, Is.EqualTo(64f / 255f).Within(0.005f));

            Object.Destroy(uiObject);
        }

        [UnityTest]
        public IEnumerator Learning_loop_primary_controls_are_rendered_and_focusable()
        {
            Screen.SetResolution(1280, 720, false);
            var uiObject = new GameObject("Learning Loop UI");
            var document = uiObject.AddComponent<UIDocument>();
            document.panelSettings = Resources.Load<PanelSettings>(
                "UI/WordQuestPanelSettings");
            var router = new ScreenRouter(document.rootVisualElement);
            yield return null;

            var cases = new[]
            {
                (ScreenId.Home, "continue-learning-button"),
                (ScreenId.LevelSelect, "difficulty-field"),
                (ScreenId.Result, "result-primary-button")
            };
            foreach (var item in cases)
            {
                var view = router.Show(item.Item1);
                yield return null;

                var control = view.Q<VisualElement>(item.Item2);
                Assert.That(
                    control,
                    Is.Not.Null,
                    $"{item.Item1} must expose {item.Item2}.");
                Assert.That(
                    control.focusable,
                    Is.True,
                    $"{item.Item2} must support keyboard focus.");
                Assert.That(
                    control.resolvedStyle.width,
                    Is.GreaterThan(0f),
                    $"{item.Item2} must have a visible width at 1280x720.");
                Assert.That(
                    control.resolvedStyle.height,
                    Is.GreaterThan(0f),
                    $"{item.Item2} must have a visible height at 1280x720.");
            }

            Object.Destroy(uiObject);
        }

        [UnityTest]
        public IEnumerator Game_shell_is_transparent_so_the_world_can_render()
        {
            var uiObject = new GameObject("Transparent Game UI");
            var document = uiObject.AddComponent<UIDocument>();
            document.panelSettings = Resources.Load<PanelSettings>(
                "UI/WordQuestPanelSettings");
            var router = new ScreenRouter(document.rootVisualElement);
            router.Show(ScreenId.Game);
            yield return null;

            Assert.That(
                router.Root.resolvedStyle.backgroundColor.a,
                Is.LessThan(0.01f),
                "The app shell must not paint over the game camera.");

            Object.Destroy(uiObject);
        }
    }
}
