using System;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using WordQuest.Infrastructure.Api;

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
        public void Mutation_routes_do_not_embed_api_origin()
        {
            Assert.That(ApiRoutes.SaveProgress, Does.StartWith("/api/"));
            Assert.That(ApiRoutes.SaveProgress, Does.Not.Contain("://"));
        }
    }
}
