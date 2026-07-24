using System;
using NUnit.Framework;
using WordQuest.Application.Social;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Tests
{
    public sealed class SocialProjectionTests
    {
        [TestCase("incoming", SocialBucket.Incoming)]
        [TestCase("outgoing", SocialBucket.Outgoing)]
        [TestCase("accepted", SocialBucket.Accepted)]
        public void Friendship_direction_maps_to_expected_bucket(
            string direction,
            SocialBucket expected)
        {
            Assert.That(
                SocialProjection.Bucket(new FriendshipDto
                {
                    direction = direction,
                    status = direction == "accepted" ? "accepted" : "pending"
                }),
                Is.EqualTo(expected));
        }

        [Test]
        public void Expired_or_submitted_challenge_is_not_playable()
        {
            Assert.That(
                SocialProjection.CanSubmit(
                    new ChallengeDto
                    {
                        status = "awaiting_opponent",
                        expiresAt = "2020-01-01T00:00:00Z"
                    },
                    false,
                    DateTimeOffset.UtcNow),
                Is.False);
            Assert.That(
                SocialProjection.CanSubmit(
                    new ChallengeDto
                    {
                        status = "awaiting_opponent",
                        expiresAt = "2099-01-01T00:00:00Z"
                    },
                    true,
                    DateTimeOffset.UtcNow),
                Is.False);
        }

        [Test]
        public void Current_user_highlighting_is_id_based()
        {
            Assert.That(SocialProjection.IsCurrentUser("42", "42"), Is.True);
            Assert.That(SocialProjection.IsCurrentUser("42", "7"), Is.False);
        }

        [TestCase(1, 3)]
        [TestCase(10, 10)]
        [TestCase(50, 20)]
        public void Pk_question_count_matches_server_bounds(
            int requested,
            int expected)
        {
            Assert.That(
                SocialProjection.NormalizeQuestionCount(requested),
                Is.EqualTo(expected));
        }
    }
}
