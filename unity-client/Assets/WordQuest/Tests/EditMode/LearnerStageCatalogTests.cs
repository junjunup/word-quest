using NUnit.Framework;
using WordQuest.Application;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Tests
{
    public sealed class LearnerStageCatalogTests
    {
        [TestCase(null, "junior")]
        [TestCase("", "junior")]
        [TestCase("UNKNOWN", "junior")]
        [TestCase(" PRIMARY ", "primary")]
        public void Normalize_returns_a_supported_stage(
            string input,
            string expected)
        {
            Assert.That(
                LearnerStageCatalog.Normalize(input),
                Is.EqualTo(expected));
        }

        [Test]
        public void Catalog_exposes_the_three_K12_stage_ranges()
        {
            Assert.That(
                LearnerStageCatalog.All.Count,
                Is.EqualTo(3));
            Assert.That(
                LearnerStageCatalog.Resolve("primary").GradeRange,
                Is.EqualTo("1–6 年级"));
            Assert.That(
                LearnerStageCatalog.Resolve("junior").GradeRange,
                Is.EqualTo("7–9 年级"));
            Assert.That(
                LearnerStageCatalog.Resolve("senior").GradeRange,
                Is.EqualTo("10–12 年级"));
        }

        [Test]
        public void Explicit_or_conventional_K12_wordbook_matches_the_stage()
        {
            Assert.That(
                LearnerStageCatalog.Evaluate(
                        "junior",
                        new WordbookDto
                        {
                            wordbookId = "custom",
                            stageId = "junior"
                        })
                    .IsCompatible,
                Is.True);
            Assert.That(
                LearnerStageCatalog.Evaluate(
                        "senior",
                        new WordbookDto
                        {
                            wordbookId = "k12-senior-core"
                        })
                    .IsCompatible,
                Is.True);
        }

        [Test]
        public void Existing_exam_wordbooks_are_extension_content()
        {
            var fit = LearnerStageCatalog.Evaluate(
                "junior",
                new WordbookDto
                {
                    wordbookId = "cet4",
                    name = "CET-4"
                });

            Assert.That(fit.IsCompatible, Is.False);
            Assert.That(fit.Label, Is.EqualTo("拓展内容"));
            Assert.That(
                new WordQuestContext().Settings.LearnerStageId,
                Is.EqualTo("junior"));
        }

        [Test]
        public void Explicit_mismatched_stage_overrides_a_compatible_id_prefix()
        {
            var fit = LearnerStageCatalog.Evaluate(
                "primary",
                new WordbookDto
                {
                    wordbookId = "k12-primary-core",
                    stageId = "senior"
                });

            Assert.That(fit.IsCompatible, Is.False);
        }

        [Test]
        public void Path_description_defers_fit_without_wordbook_metadata()
        {
            Assert.That(
                LearnerStageCatalog.DescribePath("junior"),
                Is.EqualTo(
                    "初中 · 7–9 年级学习路径 · 词书匹配请在关卡地图确认"));
        }
    }
}
