using System;

namespace WordQuest.Infrastructure.Storage
{
    public sealed class TokenStore : ITokenStore
    {
        private const string TokenKey = "wordquest:token";
        private readonly IKeyValueStore store;

        public TokenStore(IKeyValueStore store)
        {
            this.store = store ?? throw new ArgumentNullException(nameof(store));
        }

        public string Load()
        {
            return store.GetString(TokenKey, string.Empty);
        }

        public void Save(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                Clear();
                return;
            }

            store.SetString(TokenKey, token.Trim());
            store.Save();
        }

        public void Clear()
        {
            store.DeleteKey(TokenKey);
            store.Save();
        }
    }
}
