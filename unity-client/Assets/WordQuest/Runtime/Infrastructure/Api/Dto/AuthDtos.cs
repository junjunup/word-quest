using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class LoginRequest
    {
        public string username;
        public string password;
    }

    [Serializable]
    public sealed class RegisterRequest
    {
        public string username;
        public string password;
        public string nickname;
    }

    [Serializable]
    public sealed class AuthDataDto
    {
        public string token;
        public UserDto user;
    }

    [Serializable]
    public sealed class UserDto
    {
        public string id;
        public string _id;
        public string username;
        public string nickname;
        public string avatar;
        public int characterSpriteIndex;
        public int level;
        public int totalExp;
        public int totalScore;
        public int loginStreak;
        public ReminderSettingsDto reminderSettings;
    }

    [Serializable]
    public sealed class ReminderSettingsRequest
    {
        public bool enabled;
        public string time;
    }

    [Serializable]
    public sealed class ReminderSettingsDto
    {
        public bool enabled;
        public string time;
        public string lastUpdatedAt;
    }
}
