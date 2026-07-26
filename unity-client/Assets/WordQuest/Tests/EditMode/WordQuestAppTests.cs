using System.Reflection;
using NUnit.Framework;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class WordQuestAppTests
    {
        [TestCase(true, false, true)]
        [TestCase(false, true, true)]
        [TestCase(false, false, false)]
        public void Session_restore_abandons_cancelled_results(
            bool resultCancelled,
            bool lifetimeCancelled,
            bool expected)
        {
            var method = typeof(WordQuestApp).GetMethod(
                "ShouldAbandonSessionRestore",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            var result = ApiResult<UserDto>.Failure(
                0,
                "cancelled",
                resultCancelled);

            Assert.That(
                method.Invoke(
                    null,
                    new object[] { result, lifetimeCancelled }),
                Is.EqualTo(expected));
        }
    }
}
