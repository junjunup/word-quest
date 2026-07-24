using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.Callbacks;
using UnityEngine;

namespace WordQuest.Editor
{
    public sealed class MacSpeechBuildProcessor :
        IPreprocessBuildWithReport
    {
        public int callbackOrder => 0;

        public void OnPreprocessBuild(BuildReport report)
        {
            if (report.summary.platform != BuildTarget.StandaloneOSX)
                return;

            var source = Path.Combine(
                Application.dataPath,
                "WordQuest",
                "Native",
                "macOS",
                "WordQuestSpeech.mm");
            if (!File.Exists(source))
            {
                throw new BuildFailedException(
                    $"Missing macOS speech source: {source}");
            }
        }

        [PostProcessBuild(100)]
        public static void ConfigureMacSpeech(
            BuildTarget target,
            string builtProjectPath)
        {
            if (target != BuildTarget.StandaloneOSX)
                return;

            var source = Path.Combine(
                Application.dataPath,
                "WordQuest",
                "Native",
                "macOS",
                "WordQuestSpeech.mm");
            var plugins = Path.Combine(
                builtProjectPath,
                "Contents",
                "Plugins");
            Directory.CreateDirectory(plugins);
            var library = Path.Combine(
                plugins,
                "libWordQuestSpeech.dylib");
            Run(
                "/usr/bin/xcrun",
                $"--sdk macosx clang++ -dynamiclib -fobjc-arc " +
                "-framework Foundation -framework AVFoundation " +
                "-framework Speech -arch arm64 -arch x86_64 " +
                "-mmacosx-version-min=11.0 " +
                $"-o \"{library}\" \"{source}\"");

            var infoPath = Path.Combine(
                builtProjectPath,
                "Contents",
                "Info.plist");
            SetPlistString(
                infoPath,
                "LSMinimumSystemVersion",
                "11.0");
            SetPlistString(
                infoPath,
                "NSMicrophoneUsageDescription",
                "Word Quest 使用麦克风进行英语发音练习。");
            SetPlistString(
                infoPath,
                "NSSpeechRecognitionUsageDescription",
                "Word Quest 使用系统语音识别评估英语发音。");
        }

        private static void SetPlistString(
            string infoPath,
            string key,
            string value)
        {
            var document = XDocument.Load(infoPath);
            var dictionary = document.Root?.Element("dict") ??
                             throw new BuildFailedException(
                                 "Invalid macOS Info.plist.");
            var existing = dictionary
                .Elements("key")
                .FirstOrDefault(element => element.Value == key);
            if (existing != null)
            {
                var currentValue = existing.ElementsAfterSelf().FirstOrDefault();
                currentValue?.SetValue(value);
            }
            else
            {
                dictionary.Add(new XElement("key", key));
                dictionary.Add(new XElement("string", value));
            }
            document.Save(infoPath);
        }

        private static void Run(string fileName, string arguments)
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            });
            if (process == null)
            {
                throw new BuildFailedException(
                    $"Unable to start {fileName}.");
            }
            process.WaitForExit();
            if (process.ExitCode == 0)
                return;
            throw new BuildFailedException(
                $"macOS speech bridge compilation failed: " +
                process.StandardError.ReadToEnd());
        }
    }
}
