using System;
using UnityEngine;

namespace WordQuest.Infrastructure.Audio
{
    public interface ISpeechCaptureAdapter
    {
        bool IsAvailable { get; }
        string UnavailableReason { get; }
        bool Start();
        AudioClip Stop();
    }

    public sealed class MicrophoneCaptureAdapter : ISpeechCaptureAdapter
    {
        private string device;
        private AudioClip clip;

        public bool IsAvailable => Microphone.devices.Length > 0;
        public string UnavailableReason =>
            IsAvailable
                ? string.Empty
                : "未检测到可用麦克风，请在系统设置中授权后重试。";

        public bool Start()
        {
            if (!IsAvailable)
                return false;
            device = Microphone.devices[0];
            clip = Microphone.Start(device, false, 10, 16000);
            return true;
        }

        public AudioClip Stop()
        {
            if (string.IsNullOrEmpty(device) || !Microphone.IsRecording(device))
                return null;
            var position = Microphone.GetPosition(device);
            Microphone.End(device);
            device = null;
            var result = position > 0 ? clip : null;
            clip = null;
            return result;
        }
    }
}
