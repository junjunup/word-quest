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
        }
    }
}
