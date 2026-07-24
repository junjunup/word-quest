using UnityEngine;

namespace WordQuest.Infrastructure.Storage
{
    public sealed class PlayerPrefsStore : IKeyValueStore
    {
        public bool HasKey(string key)
        {
            return PlayerPrefs.HasKey(key);
        }

        public string GetString(string key, string fallback = "")
        {
            return PlayerPrefs.GetString(key, fallback);
        }

        public void SetString(string key, string value)
        {
            PlayerPrefs.SetString(key, value ?? string.Empty);
        }

        public void DeleteKey(string key)
        {
            PlayerPrefs.DeleteKey(key);
        }

        public void Save()
        {
            PlayerPrefs.Save();
        }
    }
}
