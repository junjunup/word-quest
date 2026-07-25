using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.Callbacks;
using UnityEditor.iOS.Xcode;
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
                UnityEngine.Application.dataPath,
                "WordQuest",
                "Native",
                "macOS",
                "WordQuestSpeech.mm");
            if (!File.Exists(source))
            {
                throw new BuildFailedException(
                    $"Missing macOS speech source: {source}");
            }
            var entitlements = EntitlementsPath();
            if (!File.Exists(entitlements))
            {
                throw new BuildFailedException(
                    $"Missing macOS entitlements: {entitlements}");
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
                UnityEngine.Application.dataPath,
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
                $"-o \"{library}\" \"{source}\"",
                "macOS speech bridge compilation");

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
            SignBundle(builtProjectPath);
        }

        private static void SetPlistString(
            string infoPath,
            string key,
            string value)
        {
            var document = new PlistDocument();
            document.ReadFromFile(infoPath);
            document.root.SetString(key, value);
            document.WriteToFile(infoPath);
        }

        private static void Run(
            string fileName,
            string arguments,
            string description)
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
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            process.WaitForExit();
            var standardOutput = stdout.GetAwaiter().GetResult();
            var standardError = stderr.GetAwaiter().GetResult();
            if (process.ExitCode == 0)
                return;
            throw new BuildFailedException(
                $"{description} failed: " +
                (string.IsNullOrWhiteSpace(standardError)
                    ? standardOutput
                    : standardError));
        }

        private static void SignBundle(string appPath)
        {
            var identity = Environment.GetEnvironmentVariable(
                "WORDQUEST_MAC_SIGNING_IDENTITY");
            if (string.IsNullOrWhiteSpace(identity))
                identity = "-";
            var timestamp =
                identity == "-"
                    ? "--timestamp=none"
                    : "--timestamp";
            var contents = Path.Combine(appPath, "Contents");
            foreach (var nestedCode in Directory
                         .GetFiles(
                             contents,
                             "*.dylib",
                             SearchOption.AllDirectories)
                         .OrderByDescending(path => path.Length))
            {
                Run(
                    "/usr/bin/codesign",
                    $"--force {timestamp} " +
                    $"--sign \"{identity}\" \"{nestedCode}\"",
                    $"macOS nested code signing ({nestedCode})");
            }

            var runtimeOption =
                identity == "-"
                    ? string.Empty
                    : "--options runtime ";
            Run(
                "/usr/bin/codesign",
                "--force " +
                runtimeOption +
                $"{timestamp} " +
                $"--entitlements \"{EntitlementsPath()}\" " +
                $"--sign \"{identity}\" \"{appPath}\"",
                "macOS app signing");
        }

        private static string EntitlementsPath()
        {
            return Path.Combine(
                UnityEngine.Application.dataPath,
                "WordQuest",
                "Editor",
                "macOS.entitlements");
        }
    }
}
