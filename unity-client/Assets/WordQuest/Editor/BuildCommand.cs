using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;

namespace WordQuest.Editor
{
    public static class BuildCommand
    {
        [MenuItem("Word Quest/Build/Windows x86_64")]
        public static void BuildWindows()
        {
            Build(
                BuildTarget.StandaloneWindows64,
                Path.Combine(
                    ProjectRoot,
                    "Builds",
                    "Windows",
                    "WordQuest.exe"));
        }

        [MenuItem("Word Quest/Build/macOS Universal")]
        public static void BuildMacOS()
        {
            PlayerSettings.SetArchitecture(
                BuildTargetGroup.Standalone,
                2);
            Build(
                BuildTarget.StandaloneOSX,
                Path.Combine(
                    ProjectRoot,
                    "Builds",
                    "macOS",
                    "WordQuest.app"));
        }

        private static string ProjectRoot =>
            Directory.GetParent(UnityEngine.Application.dataPath)?.FullName ??
            throw new InvalidOperationException("Unity project root not found.");

        private static void Build(BuildTarget target, string output)
        {
            ProjectValidator.ValidateOrThrow();
            var directory = Path.GetDirectoryName(output);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            var scenes = Array.FindAll(
                EditorBuildSettings.scenes,
                scene => scene.enabled);
            var options = new BuildPlayerOptions
            {
                scenes = Array.ConvertAll(scenes, scene => scene.path),
                locationPathName = output,
                target = target,
                options = BuildOptions.StrictMode
            };
            var report = BuildPipeline.BuildPlayer(options);
            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new BuildFailedException(
                    $"{target} build failed with {report.summary.totalErrors} errors.");
            }
        }
    }
}
