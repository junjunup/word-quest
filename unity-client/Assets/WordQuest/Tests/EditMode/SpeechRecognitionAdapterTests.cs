using NUnit.Framework;
using WordQuest.Infrastructure.Audio;

namespace WordQuest.Tests
{
    public sealed class SpeechRecognitionAdapterTests
    {
        [TestCase(" apple ", 1.4f, "apple", 1f)]
        [TestCase("pear", -0.2f, "pear", 0f)]
        public void Recognition_result_normalizes_text_and_confidence(
            string transcript,
            float confidence,
            string expectedTranscript,
            float expectedConfidence)
        {
            var result = new SpeechRecognitionResult(
                transcript,
                confidence);

            Assert.That(
                result.Transcript,
                Is.EqualTo(expectedTranscript));
            Assert.That(
                result.Confidence,
                Is.EqualTo(expectedConfidence));
        }
    }
}
