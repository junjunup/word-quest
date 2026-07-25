using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.UIElements;

namespace WordQuest.Editor
{
    public static class ProjectValidator
    {
        private static readonly string[] RequiredScreens =
        {
            "Login",
            "Home",
            "LevelSelect",
            "Game",
            "Result",
            "Endless",
            "Review",
            "DailyChallenge",
            "Reports",
            "Vocabulary",
            "Pronunciation",
            "Profile",
            "Leaderboard",
            "Social",
            "Challenge",
            "Character",
            "AiTutor"
        };

        [MenuItem("Word Quest/Validate Project")]
        public static void ValidateOrThrow()
        {
            if (UnityEngine.Application.unityVersion != "6000.5.3f1")
            {
                throw new BuildFailedException(
                    "Expected Unity 6000.5.3f1, found " +
                    $"{UnityEngine.Application.unityVersion}.");
            }

            var bootstrap = EditorBuildSettings.scenes.FirstOrDefault(
                scene => scene.enabled &&
                         scene.path.EndsWith(
                             "/Bootstrap.unity",
                             StringComparison.Ordinal));
            if (bootstrap == null)
                throw new BuildFailedException("Bootstrap scene is not enabled.");

            foreach (var screen in RequiredScreens)
            {
                var path =
                    $"Assets/WordQuest/Resources/UI/Screens/{screen}.uxml";
                if (AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(path) == null)
                    throw new BuildFailedException($"Missing UI screen: {path}");
            }

            const string panelPath =
                "Assets/WordQuest/Resources/UI/" +
                "WordQuestPanelSettings.asset";
            var panelSettings =
                AssetDatabase.LoadAssetAtPath<PanelSettings>(panelPath);
            if (panelSettings == null ||
                panelSettings.themeStyleSheet == null)
            {
                throw new BuildFailedException(
                    $"Missing configured PanelSettings: {panelPath}");
            }

            var domain = Path.Combine(
                UnityEngine.Application.dataPath,
                "WordQuest",
                "Domain");
            foreach (var file in Directory.GetFiles(
                         domain,
                         "*.cs",
                         SearchOption.AllDirectories))
            {
                var source = File.ReadAllText(file);
                if (source.Contains("UnityEngine"))
                {
                    throw new BuildFailedException(
                        $"Domain assembly references UnityEngine: {file}");
                }
            }

            Debug.Log("Word Quest project validation PASS");
        }
    }
}
