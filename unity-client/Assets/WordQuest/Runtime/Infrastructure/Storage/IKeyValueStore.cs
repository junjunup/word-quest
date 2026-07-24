namespace WordQuest.Infrastructure.Storage
{
    public interface IKeyValueStore
    {
        bool HasKey(string key);
        string GetString(string key, string fallback = "");
        void SetString(string key, string value);
        void DeleteKey(string key);
        void Save();
    }

    public interface ITokenStore
    {
        string Load();
        void Save(string token);
        void Clear();
    }
}
