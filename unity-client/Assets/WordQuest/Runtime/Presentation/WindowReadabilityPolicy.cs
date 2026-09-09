using UnityEngine;

namespace WordQuest.Presentation
{
    public static class WindowReadabilityPolicy
    {
        public const int TargetWidth = 1280;
        public const int TargetHeight = 720;
        public const int MinimumWidth = 960;
        public const int MinimumHeight = 540;

        public static bool NeedsRecovery(int width, int height) =>
            width < MinimumWidth || height < MinimumHeight;

        public static void ApplyAtStartup()
        {
            if (UnityEngine.Application.isEditor || Screen.fullScreen ||
                !NeedsRecovery(Screen.width, Screen.height))
                return;

            Screen.SetResolution(
                TargetWidth,
                TargetHeight,
                FullScreenMode.Windowed);
        }
    }
}
