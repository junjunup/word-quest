using System;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class ApiContractTests
    {
        [Test]
        public void Routes_cover_every_existing_server_group()
        {
            var routes = typeof(ApiRoutes)
                .GetFields(BindingFlags.Public | BindingFlags.Static)
                .Where(field => field.FieldType == typeof(string))
                .Select(field => field.GetValue(null) as string)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToArray();

            var required = new[]
            {
                "/auth/",
                "/game/",
                "/vocab/",
                "/learning/",
                "/daily-challenge/",
                "/social/",
                "/pronunciation/",
                "/chat/"
            };

            foreach (var prefix in required)
            {
                Assert.That(
                    routes.Any(route =>
                        route.IndexOf(prefix, StringComparison.Ordinal) >= 0),
                    Is.True,
                    $"Missing route group {prefix}");
            }
        }

        [Test]
        public void Quiz_record_parses_adaptive_object_from_server()
        {
            const string json =
                "{\"success\":true,\"data\":{\"adaptiveDifficulty\":{\"difficulty\":3,\"questionType\":\"spell_hint\",\"abilityScore\":0.62},\"serverIsCorrect\":true,\"serverScore\":120}}";

            var envelope =
                JsonUtility.FromJson<ApiEnvelope<QuizRecordResultDto>>(json);

            Assert.That(envelope.success, Is.True);
            Assert.That(
                envelope.data.adaptiveDifficulty.difficulty,
                Is.EqualTo(3));
            Assert.That(
                envelope.data.adaptiveDifficulty.questionType,
                Is.EqualTo("spell_hint"));
        }

        [Test]
        public void Mutation_routes_do_not_embed_api_origin()
        {
            Assert.That(ApiRoutes.SaveProgress, Does.StartWith("/api/"));
            Assert.That(ApiRoutes.SaveProgress, Does.Not.Contain("://"));
        }

        [TestCase(
            "[{\"word\":\"apple\",\"meaning\":\"苹果\"}]",
            "apple")]
        [TestCase(
            "{\"wordbookId\":\"custom\",\"words\":[{\"word\":\"pear\",\"meaning\":\"梨\"}]}",
            "pear")]
        public void Vocabulary_import_accepts_array_or_wrapped_object(
            string json,
            string expectedWord)
        {
            var parsed = VocabularyImportParser.Parse(json);

            Assert.That(parsed.words, Has.Length.EqualTo(1));
            Assert.That(parsed.words[0].word, Is.EqualTo(expectedWord));
        }
    }
}
