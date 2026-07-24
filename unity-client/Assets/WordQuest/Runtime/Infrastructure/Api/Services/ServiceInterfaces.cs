using System;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public interface IAuthService
    {
        Task<ApiResult<AuthDataDto>> LoginAsync(
            string username,
            string password,
            CancellationToken cancellationToken);
        Task<ApiResult<AuthDataDto>> RegisterAsync(
            string username,
            string password,
            string nickname,
            CancellationToken cancellationToken);
        Task<ApiResult<UserDto>> GetCurrentUserAsync(
            CancellationToken cancellationToken);
        Task<ApiResult<ReminderSettingsDto>> UpdateReminderAsync(
            bool enabled,
            string time,
            CancellationToken cancellationToken);
        void SignOut();
    }

    public interface IGameService
    {
        Task<ApiResult<ProgressDto>> GetProgressAsync(CancellationToken token);
        Task<ApiResult<ProgressDto>> SaveProgressAsync(
            SaveProgressRequest request,
            CancellationToken token);
        Task<ApiResult<LeaderboardEntryDto[]>> GetLeaderboardAsync(
            string type,
            CancellationToken token);
        Task<ApiResult<AchievementDto[]>> GetAchievementsAsync(
            CancellationToken token);
        Task<ApiResult<AchievementDto[]>> SaveAchievementAsync(
            AchievementRequest request,
            CancellationToken token);
        Task<ApiResult<DailyRewardDto>> ClaimDailyRewardAsync(
            CancellationToken token);
        Task<ApiResult<UserDto>> UpdateCharacterAsync(
            int characterIndex,
            CancellationToken token);
        Task<ApiResult<LevelsStatusDto>> GetLevelsStatusAsync(
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<EndlessScoreDto>> SubmitEndlessScoreAsync(
            int score,
            int maximumStreak,
            CancellationToken token);
        Task<ApiResult<EndlessScoreDto>> GetEndlessBestAsync(
            CancellationToken token);
    }

    public interface IVocabularyService
    {
        Task<ApiResult<WordDto[]>> GetLevelWordsAsync(
            int chapter,
            int level,
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<WordDto[]>> GetChapterWordsAsync(
            int chapter,
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<QuizDto>> GetQuizAsync(
            string wordId,
            string questionType,
            CancellationToken token);
        Task<ApiResult<WordDto[]>> SearchAsync(
            string query,
            CancellationToken token);
        Task<ApiResult<WordbookDto[]>> GetWordbooksAsync(
            CancellationToken token);
        Task<ApiResult<VocabularyStatsDto>> GetStatsAsync(
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<VocabularyImportDto>> ImportAsync(
            VocabularyImportRequest request,
            CancellationToken token);
        Task<ApiResult<VocabularySourceManifestDto>> GetSourceManifestAsync(
            CancellationToken token);
    }

    public interface ILearningService
    {
        Task<ApiResult<QuizRecordResultDto>> SubmitQuizRecordAsync(
            QuizRecordRequest request,
            CancellationToken token);
        Task<ApiResult<WordDto[]>> GetTodayReviewAsync(
            int limit,
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<MasterySummaryDto>> GetMasterySummaryAsync(
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<MasteryWordDto[]>> GetMasteryWordsAsync(
            string wordbookId,
            string mode,
            int limit,
            CancellationToken token);
        Task<ApiResult<ReviewSessionDto>> CreateReviewSessionAsync(
            ReviewSessionRequest request,
            CancellationToken token);
        Task<ApiResult<ReviewSessionDto>> SubmitReviewSessionAsync(
            string sessionId,
            ReviewSubmissionRequest request,
            CancellationToken token);
        Task<ApiResult<LearningStatsDto>> GetStatsAsync(
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<ErrorTypeStatsDto>> GetErrorTypesAsync(
            string wordbookId,
            int days,
            CancellationToken token);
        Task<ApiResult<DailyStatDto[]>> GetDailyStatsAsync(
            int days,
            CancellationToken token);
        Task<ApiResult<ChapterStatDto[]>> GetChapterStatsAsync(
            CancellationToken token);
        Task<ApiResult<MistakeDto[]>> GetTopMistakesAsync(
            int limit,
            CancellationToken token);
        Task<ApiResult<HeatmapEntryDto[]>> GetHeatmapAsync(
            int year,
            CancellationToken token);
    }

    public interface IDailyChallengeService
    {
        Task<ApiResult<DailyChallengeDto>> GetTodayAsync(
            string wordbookId,
            CancellationToken token);
        Task<ApiResult<DailyChallengeDto>> SubmitAsync(
            string id,
            DailyChallengeSubmitRequest request,
            CancellationToken token);
        Task<ApiResult<DailyLeaderboardEntryDto[]>> GetLeaderboardAsync(
            string wordbookId,
            string date,
            CancellationToken token);
    }

    public interface ISocialService
    {
        Task<ApiResult<PublicUserDto[]>> SearchUsersAsync(
            string query,
            CancellationToken token);
        Task<ApiResult<FriendshipDto[]>> GetFriendsAsync(
            CancellationToken token);
        Task<ApiResult<FriendshipDto>> SendFriendRequestAsync(
            FriendRequestDto request,
            CancellationToken token);
        Task<ApiResult<FriendshipDto>> RespondAsync(
            string friendshipId,
            bool accept,
            CancellationToken token);
        Task<ApiResult<FriendshipDto>> DeleteAsync(
            string friendshipId,
            CancellationToken token);
        Task<ApiResult<ChallengeDto>> CreateChallengeAsync(
            CreateChallengeRequest request,
            CancellationToken token);
        Task<ApiResult<ChallengeDto[]>> GetChallengesAsync(
            CancellationToken token);
        Task<ApiResult<ChallengeDto>> GetChallengeAsync(
            string id,
            CancellationToken token);
        Task<ApiResult<ChallengeDto>> SubmitChallengeAsync(
            string id,
            ChallengeSubmissionRequest request,
            CancellationToken token);
    }

    public interface IPronunciationService
    {
        Task<ApiResult<PronunciationResultDto>> ScoreAsync(
            PronunciationRequest request,
            CancellationToken token);
        Task<ApiResult<PronunciationResultDto[]>> GetHistoryAsync(
            string word,
            int limit,
            CancellationToken token);
    }

    public interface IChatService
    {
        Task StreamAsync(
            ChatRequest request,
            Action<string> onDelta,
            CancellationToken token);
    }
}
