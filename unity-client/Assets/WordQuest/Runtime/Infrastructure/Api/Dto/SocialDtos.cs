using System;

namespace WordQuest.Infrastructure.Api.Dto
{
    [Serializable]
    public sealed class PublicUserDto
    {
        public string id;
        public string username;
        public string nickname;
        public string avatar;
        public int level;
        public int totalScore;
    }

    [Serializable]
    public sealed class FriendshipDto
    {
        public string id;
        public string status;
        public string direction;
        public PublicUserDto user;
        public string createdAt;
        public string updatedAt;
    }

    [Serializable]
    public sealed class FriendRequestDto
    {
        public string userId;
        public string username;
    }

    [Serializable]
    public sealed class FriendResponseDto
    {
        public bool accept;
    }

    [Serializable]
    public sealed class CreateChallengeRequest
    {
        public string opponentId;
        public int questionCount;
        public string wordbookId;
        public int chapter;
        public int level;
    }

    [Serializable]
    public sealed class ChallengeDto
    {
        public string id;
        public PublicUserDto challenger;
        public PublicUserDto opponent;
        public string wordbookId;
        public string wordbookName;
        public int chapter;
        public int level;
        public int questionCount;
        public string status;
        public ChallengeWordDto[] words;
        public ChallengeSubmissionDto[] submissions;
        public string winnerId;
        public string createdAt;
        public string expiresAt;
    }

    [Serializable]
    public sealed class ChallengeWordDto
    {
        public string wordId;
        public string word;
        public string meaning;
        public string phonetic;
        public string example;
        public string exampleTranslation;
    }

    [Serializable]
    public sealed class ChallengeSubmissionRequest
    {
        public ChallengeAnswerDto[] answers;
    }

    [Serializable]
    public sealed class ChallengeAnswerDto
    {
        public string wordId;
        public string answer;
    }

    [Serializable]
    public sealed class ChallengeSubmissionDto
    {
        public string userId;
        public int correctCount;
        public int score;
        public string submittedAt;
    }
}
