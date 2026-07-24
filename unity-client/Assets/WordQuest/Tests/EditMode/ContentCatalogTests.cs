using NUnit.Framework;
using WordQuest.Content;

namespace WordQuest.Tests
{
    public sealed class ContentCatalogTests
    {
        [Test]
        public void Cet4_catalog_has_six_chapters_and_one_hundred_eighty_levels()
        {
            var catalog = ContentCatalog.LoadFromJson(TestLevels.Json);

            Assert.That(catalog.Chapters.Count, Is.EqualTo(6));
            Assert.That(catalog.Levels.Count, Is.EqualTo(180));
        }

        [Test]
        public void Every_level_is_valid_and_every_chapter_has_a_theme()
        {
            var catalog = ContentCatalog.LoadFromJson(TestLevels.Json);

            foreach (var level in catalog.Levels)
            {
                Assert.That(level.WordsCount, Is.GreaterThanOrEqualTo(0));
                Assert.That(catalog.GetTheme(level.Chapter), Is.Not.Null);
            }
        }

        private static class TestLevels
        {
            public const string Json =
                "{\"chapters\":[{\"id\":1,\"name\":\"A\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" +
                Levels +
                "]}," +
                "{\"id\":2,\"name\":\"B\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" + Levels + "]}," +
                "{\"id\":3,\"name\":\"C\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" + Levels + "]}," +
                "{\"id\":4,\"name\":\"D\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" + Levels + "]}," +
                "{\"id\":5,\"name\":\"E\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" + Levels + "]}," +
                "{\"id\":6,\"name\":\"F\",\"theme\":\"T\",\"description\":\"D\",\"color\":\"#335544\",\"levels\":[" + Levels + "]}]}";

            private const string Levels =
                "{\"id\":1,\"name\":\"L1\",\"wordsCount\":25,\"category\":\"cet4\",\"bossType\":\"roaming\"}," +
                "{\"id\":2,\"name\":\"L2\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":3,\"name\":\"L3\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":4,\"name\":\"L4\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":5,\"name\":\"L5\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":6,\"name\":\"L6\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":7,\"name\":\"L7\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":8,\"name\":\"L8\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":9,\"name\":\"L9\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":10,\"name\":\"L10\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":11,\"name\":\"L11\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":12,\"name\":\"L12\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":13,\"name\":\"L13\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":14,\"name\":\"L14\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":15,\"name\":\"L15\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":16,\"name\":\"L16\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":17,\"name\":\"L17\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":18,\"name\":\"L18\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":19,\"name\":\"L19\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":20,\"name\":\"L20\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":21,\"name\":\"L21\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":22,\"name\":\"L22\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":23,\"name\":\"L23\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":24,\"name\":\"L24\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":25,\"name\":\"L25\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":26,\"name\":\"L26\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":27,\"name\":\"L27\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":28,\"name\":\"L28\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":29,\"name\":\"L29\",\"wordsCount\":25,\"category\":\"cet4\"}," +
                "{\"id\":30,\"name\":\"L30\",\"wordsCount\":25,\"category\":\"cet4\"}";
        }
    }
}
