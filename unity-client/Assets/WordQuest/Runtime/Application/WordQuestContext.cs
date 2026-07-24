using System;

namespace WordQuest.Application
{
    public sealed class UserProfile
    {
        public string Id { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int TotalScore { get; set; }
        public int Coins { get; set; }
        public string CharacterId { get; set; } = "default";
        public int LoginStreak { get; set; }
    }

    public sealed class UserSettings
    {
        public float MusicVolume { get; set; } = 0.7f;
        public float EffectsVolume { get; set; } = 0.9f;
        public string Difficulty { get; set; } = "normal";
        public string WordbookId { get; set; } = "cet4";
        public bool ReducedMotion { get; set; }
        public bool HighContrast { get; set; }
        public bool ReminderEnabled { get; set; }
        public string ReminderTime { get; set; } = "20:00";
    }

    public sealed class WordQuestContext
    {
        public UserProfile User { get; private set; }
        public UserSettings Settings { get; } = new UserSettings();
        public bool IsAuthenticated => User != null;

        public event Action Changed;

        public void SignIn(UserProfile user)
        {
            User = user ?? throw new ArgumentNullException(nameof(user));
            Changed?.Invoke();
        }

        public void SignOut()
        {
            User = null;
            Changed?.Invoke();
        }

        public void NotifySettingsChanged()
        {
            Changed?.Invoke();
        }
    }
}
