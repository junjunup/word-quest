using System;

namespace WordQuest.Infrastructure.Api
{
    public static class ApiRoutes
    {
        public const string Login = "/api/auth/login";
        public const string Register = "/api/auth/register";
        public const string CurrentUser = "/api/auth/me";
        public const string ReminderSettings = "/api/auth/reminder-settings";

        public const string Progress = "/api/game/progress";
        public const string SaveProgress = "/api/game/progress";
        public const string Leaderboard = "/api/game/leaderboard";
        public const string Achievements = "/api/game/achievements";
        public const string DailyReward = "/api/game/daily-reward";
        public const string Character = "/api/game/character";
        public const string LevelsStatus = "/api/game/levels-status";
        public const string EndlessScore = "/api/game/endless-score";

        public const string VocabularyStats = "/api/vocab/stats";
        public const string VocabularyImport = "/api/vocab/import";
        public const string Wordbooks = "/api/vocab/wordbooks";
        public const string VocabularySourceManifest = "/api/vocab/source-manifest";
        public const string VocabularySearch = "/api/vocab/search";

        public const string ReviewToday = "/api/learning/review/today";
        public const string QuizRecord = "/api/learning/quiz-record";
        public const string MasterySummary = "/api/learning/mastery/summary";
        public const string MasteryWords = "/api/learning/mastery/words";
        public const string ReviewSessions = "/api/learning/review/sessions";
        public const string LearningStats = "/api/learning/stats";
        public const string ErrorTypes = "/api/learning/error-types";
        public const string DailyStats = "/api/learning/daily-stats";
        public const string ChapterStats = "/api/learning/chapter-stats";
        public const string TopMistakes = "/api/learning/top-mistakes";
        public const string Heatmap = "/api/learning/heatmap";

        public const string DailyChallengeToday = "/api/daily-challenge/today";
        public const string DailyChallengeLeaderboard = "/api/daily-challenge/leaderboard";

        public const string UserSearch = "/api/social/users/search";
        public const string Friends = "/api/social/friends";
        public const string FriendRequest = "/api/social/friends/request";
        public const string Challenges = "/api/social/challenges";

        public const string PronunciationScore = "/api/pronunciation/score";
        public const string PronunciationHistory = "/api/pronunciation/history";

        public const string ChatMessage = "/api/chat/message";
        public const string ChatStream = "/api/chat/stream";

        public static string Chapter(int chapter)
        {
            return $"/api/vocab/chapter/{Math.Max(1, chapter)}";
        }

        public static string Level(int chapter, int level)
        {
            return $"{Chapter(chapter)}/level/{Math.Max(1, level)}";
        }

        public static string Quiz(string wordId)
        {
            return $"/api/vocab/quiz/{Escape(wordId)}";
        }

        public static string ReviewSession(string id)
        {
            return $"/api/learning/review/sessions/{Escape(id)}/submit";
        }

        public static string DailyChallengeSubmit(string id)
        {
            return $"/api/daily-challenge/{Escape(id)}/submit";
        }

        public static string FriendshipResponse(string id)
        {
            return $"/api/social/friends/{Escape(id)}/respond";
        }

        public static string Friendship(string id)
        {
            return $"/api/social/friends/{Escape(id)}";
        }

        public static string Challenge(string id)
        {
            return $"/api/social/challenges/{Escape(id)}";
        }

        public static string ChallengeSubmit(string id)
        {
            return $"{Challenge(id)}/submit";
        }

        public static string WithQuery(string route, string name, string value)
        {
            return $"{route}?{Escape(name)}={Escape(value)}";
        }

        public static string AddQuery(
            string route,
            params (string name, string value)[] values)
        {
            if (values == null || values.Length == 0)
                return route;

            var query = string.Empty;
            foreach (var pair in values)
            {
                if (string.IsNullOrEmpty(pair.value))
                    continue;
                query += (query.Length == 0 ? "?" : "&") +
                         Escape(pair.name) +
                         "=" +
                         Escape(pair.value);
            }

            return route + query;
        }

        private static string Escape(string value)
        {
            return Uri.EscapeDataString(value ?? string.Empty);
        }
    }
}
