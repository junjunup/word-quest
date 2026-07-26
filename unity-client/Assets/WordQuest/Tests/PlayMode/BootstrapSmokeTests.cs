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

            Object.Destroy(uiObject);
        }
    }
}
