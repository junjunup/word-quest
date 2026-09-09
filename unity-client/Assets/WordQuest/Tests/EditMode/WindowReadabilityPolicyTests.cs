using NUnit.Framework;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class WindowReadabilityPolicyTests
    {
        [TestCase(959, 540, true)]
        [TestCase(960, 539, true)]
        [TestCase(960, 540, false)]
        [TestCase(1440, 900, false)]
        public void Recovery_is_required_only_below_the_readable_floor(
            int width,
            int height,
            bool expected)
        {
            Assert.That(
                WindowReadabilityPolicy.NeedsRecovery(width, height),
                Is.EqualTo(expected));
        }

        [Test]
        public void Recovery_target_is_the_blind_review_baseline()
        {
            Assert.That(WindowReadabilityPolicy.TargetWidth, Is.EqualTo(1280));
            Assert.That(WindowReadabilityPolicy.TargetHeight, Is.EqualTo(720));
        }
    }
}
