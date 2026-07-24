using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class AiTutorSmokeTests
    {
        [UnityTest]
        public IEnumerator Tutor_screen_can_be_routed()
        {
            yield return null;
            var app = Object.FindAnyObjectByType<WordQuestApp>();

            Assert.That(app, Is.Not.Null);
            app.Navigate(ScreenId.AiTutor);
            yield return null;
            Assert.That(GameObject.Find("WordQuest UI"), Is.Not.Null);
        }
    }
}
