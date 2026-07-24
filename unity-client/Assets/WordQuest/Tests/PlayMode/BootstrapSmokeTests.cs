using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
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
                Object.FindObjectsByType<WordQuestApp>(
                    FindObjectsSortMode.None),
                Has.Length.EqualTo(1));
            Assert.That(GameObject.Find("WordQuest UI"), Is.Not.Null);
        }
    }
}
