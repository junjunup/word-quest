using System;
using System.Collections.Generic;
using UnityEngine;

namespace WordQuest.Infrastructure.Storage
{
    [Serializable]
    public sealed class PendingSubmission
    {
        public string id;
        public string route;
        public string method;
        public string jsonBody;
        public long createdAtUnixMs;
        public int attempts;
    }

    [Serializable]
    internal sealed class PendingSubmissionList
    {
        public List<PendingSubmission> items = new List<PendingSubmission>();
    }

    public sealed class PendingSyncQueue
    {
        private const string QueueKey = "wordquest:pending-sync";
        private readonly IKeyValueStore store;

        public PendingSyncQueue(IKeyValueStore store)
        {
            this.store = store ?? throw new ArgumentNullException(nameof(store));
        }

        public void Enqueue(PendingSubmission item)
        {
            if (item == null)
                throw new ArgumentNullException(nameof(item));

            var wrapper = ReadWrapper();
            wrapper.items.Add(item);
            Write(wrapper);
        }

        public IReadOnlyList<PendingSubmission> ReadAll()
        {
            return ReadWrapper().items.AsReadOnly();
        }

        public void Replace(IReadOnlyList<PendingSubmission> items)
        {
            var wrapper = new PendingSubmissionList();
            if (items != null)
                wrapper.items.AddRange(items);
            Write(wrapper);
        }

        public void Clear()
        {
            store.DeleteKey(QueueKey);
            store.Save();
        }

        private PendingSubmissionList ReadWrapper()
        {
            var json = store.GetString(QueueKey, string.Empty);
            if (string.IsNullOrWhiteSpace(json))
                return new PendingSubmissionList();

            try
            {
                return JsonUtility.FromJson<PendingSubmissionList>(json) ??
                       new PendingSubmissionList();
            }
            catch (ArgumentException)
            {
                return new PendingSubmissionList();
            }
        }

        private void Write(PendingSubmissionList wrapper)
        {
            store.SetString(QueueKey, JsonUtility.ToJson(wrapper));
            store.Save();
        }
    }
}
