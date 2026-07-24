using System;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
using UnityEngine.Windows.Speech;
#endif

namespace WordQuest.Infrastructure.Audio
{
    public sealed class SpeechRecognitionResult
    {
        public SpeechRecognitionResult(string transcript, float confidence)
        {
            Transcript = transcript?.Trim() ?? string.Empty;
            Confidence = Mathf.Clamp01(confidence);
        }

        public string Transcript { get; }
        public float Confidence { get; }
    }

    public interface ISpeechRecognitionAdapter : IDisposable
    {
        bool IsAvailable { get; }
        string UnavailableReason { get; }
        bool IsListening { get; }
        bool Start();
        void Stop();
        bool TryGetResult(
            out SpeechRecognitionResult result,
            out string error);
    }

    public static class SpeechRecognitionAdapter
    {
        public static ISpeechRecognitionAdapter Create()
        {
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            return new WindowsSpeechRecognitionAdapter();
#elif UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
            return new MacSpeechRecognitionAdapter();
#else
            return new UnsupportedSpeechRecognitionAdapter();
#endif
        }
    }

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
    internal sealed class WindowsSpeechRecognitionAdapter :
        ISpeechRecognitionAdapter
    {
        private DictationRecognizer recognizer;
        private SpeechRecognitionResult pendingResult;
        private string pendingError;

        public bool IsAvailable =>
            Application.platform == RuntimePlatform.WindowsPlayer ||
            Application.platform == RuntimePlatform.WindowsEditor;
        public string UnavailableReason =>
            IsAvailable
                ? string.Empty
                : "Windows 系统语音识别仅能在 Windows 编辑器或桌面客户端中使用。";
        public bool IsListening =>
            recognizer != null &&
            recognizer.Status == SpeechSystemStatus.Running;

        public bool Start()
        {
            if (!IsAvailable)
                return false;

            DisposeRecognizer();
            pendingResult = null;
            pendingError = null;
            recognizer = new DictationRecognizer(
                ConfidenceLevel.Low,
                DictationTopicConstraint.Dictation);
            recognizer.AutoSilenceTimeoutSeconds = 3f;
            recognizer.InitialSilenceTimeoutSeconds = 5f;
            recognizer.DictationResult += OnResult;
            recognizer.DictationError += OnError;
            recognizer.DictationComplete += OnComplete;
            try
            {
                recognizer.Start();
                return true;
            }
            catch (Exception exception)
            {
                pendingError = exception.Message;
                DisposeRecognizer();
                return false;
            }
        }

        public void Stop()
        {
            if (recognizer == null)
                return;
            try
            {
                recognizer.Stop();
            }
            catch (Exception exception)
            {
                pendingError = exception.Message;
            }
        }

        public bool TryGetResult(
            out SpeechRecognitionResult result,
            out string error)
        {
            result = pendingResult;
            error = pendingError;
            pendingResult = null;
            pendingError = null;
            return result != null || !string.IsNullOrWhiteSpace(error);
        }

        public void Dispose()
        {
            DisposeRecognizer();
        }

        private void OnResult(string text, ConfidenceLevel confidence)
        {
            pendingResult = new SpeechRecognitionResult(
                text,
                ConfidenceValue(confidence));
            Stop();
        }

        private void OnError(string error, int hresult)
        {
            pendingError = $"{error} (0x{hresult:X8})";
        }

        private void OnComplete(DictationCompletionCause cause)
        {
            if (pendingResult == null &&
                string.IsNullOrWhiteSpace(pendingError))
            {
                pendingError =
                    cause == DictationCompletionCause.Complete
                        ? "没有识别到有效语音。"
                        : $"语音识别未完成：{cause}";
            }
        }

        private void DisposeRecognizer()
        {
            if (recognizer == null)
                return;
            recognizer.DictationResult -= OnResult;
            recognizer.DictationError -= OnError;
            recognizer.DictationComplete -= OnComplete;
            if (recognizer.Status == SpeechSystemStatus.Running)
                recognizer.Stop();
            recognizer.Dispose();
            recognizer = null;
        }

        private static float ConfidenceValue(ConfidenceLevel value)
        {
            switch (value)
            {
                case ConfidenceLevel.High: return 0.95f;
                case ConfidenceLevel.Medium: return 0.75f;
                case ConfidenceLevel.Low: return 0.5f;
                default: return 0.1f;
            }
        }
    }
#endif

#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
    internal sealed class MacSpeechRecognitionAdapter :
        ISpeechRecognitionAdapter
    {
        public bool IsAvailable
        {
            get
            {
                if (Application.platform != RuntimePlatform.OSXPlayer)
                    return false;
                try
                {
                    return WordQuestSpeechIsAvailable() != 0;
                }
                catch (DllNotFoundException)
                {
                    return false;
                }
                catch (EntryPointNotFoundException)
                {
                    return false;
                }
            }
        }

        public string UnavailableReason =>
            Application.platform == RuntimePlatform.OSXEditor
                ? "macOS 系统语音识别桥接在桌面 Player 构建中启用；编辑器内可使用手动文本兜底。"
                : "macOS Speech 服务不可用，或麦克风/语音识别权限未授权。";

        public bool IsListening
        {
            get
            {
                try
                {
                    return WordQuestSpeechState() == 1;
                }
                catch
                {
                    return false;
                }
            }
        }

        public bool Start()
        {
            if (!IsAvailable)
                return false;
            return WordQuestSpeechStart("en-US") != 0;
        }

        public void Stop()
        {
            WordQuestSpeechStop();
        }

        public bool TryGetResult(
            out SpeechRecognitionResult result,
            out string error)
        {
            result = null;
            error = string.Empty;
            int state;
            try
            {
                state = WordQuestSpeechState();
            }
            catch (DllNotFoundException)
            {
                return false;
            }
            catch (EntryPointNotFoundException)
            {
                return false;
            }
            if (state != 2 && state != 3)
                return false;

            var text = FromUtf8(
                WordQuestSpeechTranscript());
            if (state == 2 && !string.IsNullOrWhiteSpace(text))
            {
                result = new SpeechRecognitionResult(
                    text,
                    WordQuestSpeechConfidence());
            }
            else
            {
                error = string.IsNullOrWhiteSpace(text)
                    ? "没有识别到有效语音。"
                    : text;
            }
            WordQuestSpeechReset();
            return true;
        }

        private static string FromUtf8(IntPtr pointer)
        {
            if (pointer == IntPtr.Zero)
                return string.Empty;
            var length = 0;
            while (Marshal.ReadByte(pointer, length) != 0)
                length++;
            if (length == 0)
                return string.Empty;
            var bytes = new byte[length];
            Marshal.Copy(pointer, bytes, 0, length);
            return Encoding.UTF8.GetString(bytes);
        }

        public void Dispose()
        {
            try
            {
                WordQuestSpeechReset();
            }
            catch
            {
                // The bridge is intentionally unavailable in the editor.
            }
        }

        [DllImport("WordQuestSpeech")]
        private static extern int WordQuestSpeechIsAvailable();

        [DllImport("WordQuestSpeech")]
        private static extern int WordQuestSpeechStart(string locale);

        [DllImport("WordQuestSpeech")]
        private static extern void WordQuestSpeechStop();

        [DllImport("WordQuestSpeech")]
        private static extern int WordQuestSpeechState();

        [DllImport("WordQuestSpeech")]
        private static extern IntPtr WordQuestSpeechTranscript();

        [DllImport("WordQuestSpeech")]
        private static extern float WordQuestSpeechConfidence();

        [DllImport("WordQuestSpeech")]
        private static extern void WordQuestSpeechReset();
    }
#endif

    internal sealed class UnsupportedSpeechRecognitionAdapter :
        ISpeechRecognitionAdapter
    {
        public bool IsAvailable => false;
        public string UnavailableReason =>
            "当前平台不支持系统语音识别，请使用文本输入兜底。";
        public bool IsListening => false;
        public bool Start() => false;
        public void Stop() { }

        public bool TryGetResult(
            out SpeechRecognitionResult result,
            out string error)
        {
            result = null;
            error = string.Empty;
            return false;
        }

        public void Dispose() { }
    }
}
