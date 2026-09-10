using System;
using System.Collections.Generic;
using UnityEngine;
using WordQuest.Domain.Game;

namespace WordQuest.Infrastructure.Storage
{
    [Serializable]
    public sealed class PendingSubmission
    {
        public string id;
        public string userId;
        public string route;
        public string method;
        public string jsonBody;
        public long createdAtUnixMs;
        public int attempts;
        public bool progressSaved;
        public AchievementRunEvidence achievementEvidence;
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

        public void RememberQuiz(string userId, WordQuest.Infrastructure.Api.Dto.QuizRecordRequest request)
        {
            var rows = ReadQuizzes(userId);
            if (rows.Exists(x => x.attemptId == request.attemptId)) return;
            rows.Add(request);
            WriteQuizzes(userId, rows);
        }
        public List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest> ReadQuizzes(string userId)
        {
            var json = store.GetString(KeyFor(RequireUserId(userId)) + ":quizzes", "");
            return string.IsNullOrEmpty(json) ? new List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest>() :
                JsonUtility.FromJson<PendingQuizList>(json)?.items ?? new List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest>();
        }
        public void RemoveQuiz(string userId, string attemptId)
        {
            var rows = ReadQuizzes(userId);
            rows.RemoveAll(x => x.attemptId == attemptId);
            WriteQuizzes(userId, rows);
        }
        private void WriteQuizzes(string userId, List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest> items)
        {
            store.SetString(KeyFor(RequireUserId(userId)) + ":quizzes", JsonUtility.ToJson(new PendingQuizList { items = items }));
            store.Save();
        }
        [Serializable] private sealed class PendingQuizList
        {
            public List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest> items = new List<WordQuest.Infrastructure.Api.Dto.QuizRecordRequest>();
        }

        public void Enqueue(string userId, PendingSubmission item)
        {
            if (item == null)
                throw new ArgumentNullException(nameof(item));
            userId = RequireUserId(userId);
            if (!string.IsNullOrWhiteSpace(item.userId) &&
                !string.Equals(
                    item.userId,
                    userId,
                    StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "Pending submission belongs to another user.",
                    nameof(item));
            }

            item.userId = userId;
            var wrapper = ReadWrapper(userId);
            wrapper.items.Add(item);
            Write(userId, wrapper);
        }

        public IReadOnlyList<PendingSubmission> ReadAll(string userId)
        {
            return ReadWrapper(RequireUserId(userId)).items.AsReadOnly();
        }

        public void Replace(
            string userId,
            IReadOnlyList<PendingSubmission> items)
        {
            userId = RequireUserId(userId);
            var wrapper = new PendingSubmissionList();
            if (items != null)
            {
                foreach (var item in items)
                {
                    if (item != null &&
                        string.Equals(
                            item.userId,
                            userId,
                            StringComparison.Ordinal))
                    {
                        wrapper.items.Add(item);
                    }
                }
            }
            Write(userId, wrapper);
        }

        public void Clear(string userId)
        {
            store.DeleteKey(KeyFor(RequireUserId(userId)));
            store.Save();
        }

        public void Remove(string userId, string submissionId)
        {
            userId = RequireUserId(userId);
            if (string.IsNullOrWhiteSpace(submissionId))
                return;
            var wrapper = ReadWrapper(userId);
            wrapper.items.RemoveAll(item =>
                item != null &&
                string.Equals(
                    item.id,
                    submissionId,
                    StringComparison.Ordinal));
            Write(userId, wrapper);
        }

        private PendingSubmissionList ReadWrapper(string userId)
        {
            var json = store.GetString(KeyFor(userId), string.Empty);
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

        private void Write(
            string userId,
            PendingSubmissionList wrapper)
        {
            store.SetString(KeyFor(userId), JsonUtility.ToJson(wrapper));
            store.Save();
        }

        private static string KeyFor(string userId)
        {
            return $"{QueueKey}:{userId}";
        }

        private static string RequireUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(
                    "A signed-in user is required for pending sync.",
                    nameof(userId));
            }
            return userId.Trim();
        }
    }
}
