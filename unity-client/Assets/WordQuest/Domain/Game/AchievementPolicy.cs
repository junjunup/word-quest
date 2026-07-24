using System;
using System.Collections.Generic;

namespace WordQuest.Domain.Game
{
    public sealed class Achievement
    {
        public Achievement(string id, string name, string description, string icon)
        {
            Id = id;
            Name = name;
            Description = description;
            Icon = icon;
        }

        public string Id { get; }
        public string Name { get; }
        public string Description { get; }
        public string Icon { get; }
    }

    public sealed class AchievementContext
    {
        public int LevelsCompleted { get; set; }
        public int PerfectClears { get; set; }
        public int MaximumCombo { get; set; }
        public int WordsLearned { get; set; }
        public int ChaptersCompleted { get; set; }
        public int FastestCorrectMs { get; set; }
        public int LoginStreak { get; set; }
        public int NpcChats { get; set; }
    }

    [Serializable]
    public sealed class AchievementRunEvidence
    {
        public int Chapter;
        public int Level;
        public int CorrectCount;
        public int WrongCount;
        public int MaximumCombo;
        public int FastestCorrectMs;
        public string WordbookId;

        public static AchievementRunEvidence From(
            LevelResult result,
            string wordbookId)
        {
            if (result == null)
                throw new ArgumentNullException(nameof(result));
            return new AchievementRunEvidence
            {
                Chapter = result.Chapter,
                Level = result.Level,
                CorrectCount = result.CorrectCount,
                WrongCount = result.WrongCount,
                MaximumCombo = result.MaximumCombo,
                FastestCorrectMs = result.FastestCorrectMs,
                WordbookId = string.IsNullOrWhiteSpace(wordbookId)
                    ? "cet4"
                    : wordbookId
            };
        }
    }

    public static class AchievementPolicy
    {
        private static readonly Achievement[] Definitions =
        {
            new Achievement("first_clear", "初入大陆", "完成第一个关卡", "🎮"),
            new Achievement("perfect_clear", "完美通关", "某关卡全部答对", "⭐"),
            new Achievement("combo_5", "连击新星", "达成5连击", "🔥"),
            new Achievement("combo_10", "连击大师", "达成10连击", "💥"),
            new Achievement("words_50", "初学乍练", "学习50个单词", "📖"),
            new Achievement("words_100", "百词斩", "学习100个单词", "📚"),
            new Achievement("words_200", "词汇达人", "学习200个单词", "🎓"),
            new Achievement("words_400", "词汇大师", "学习全部400个单词", "👑"),
            new Achievement("chapter_1", "章节开拓者", "完成第一章", "🏠"),
            new Achievement("chapter_3", "商贸奇才", "完成第三章", "💰"),
            new Achievement("chapter_6", "终极勇者", "完成第六章", "🏆"),
            new Achievement("speed_demon", "闪电答题", "3秒内答对一题", "⚡"),
            new Achievement("login_3", "三天打鱼", "连续登录3天", "📅"),
            new Achievement("login_7", "一周坚持", "连续登录7天", "🗓️"),
            new Achievement("login_30", "持之以恒", "连续登录30天", "🌟"),
            new Achievement("npc_friend", "小智的朋友", "与小智对话10次", "🤖")
        };

        public static IReadOnlyList<Achievement> All => Definitions;

        public static IReadOnlyList<Achievement> FindUnlocked(
            AchievementContext context,
            ISet<string> unlocked)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            unlocked = unlocked ?? new HashSet<string>();
            var found = new List<Achievement>();

            foreach (var achievement in Definitions)
            {
                if (unlocked.Contains(achievement.Id))
                    continue;
                if (!MeetsRequirement(achievement.Id, context))
                    continue;

                found.Add(achievement);
            }

            return found;
        }

        private static bool MeetsRequirement(
            string id,
            AchievementContext context)
        {
            switch (id)
            {
                case "first_clear": return context.LevelsCompleted >= 1;
                case "perfect_clear": return context.PerfectClears >= 1;
                case "combo_5": return context.MaximumCombo >= 5;
                case "combo_10": return context.MaximumCombo >= 10;
                case "words_50": return context.WordsLearned >= 50;
                case "words_100": return context.WordsLearned >= 100;
                case "words_200": return context.WordsLearned >= 200;
                case "words_400": return context.WordsLearned >= 400;
                case "chapter_1": return context.ChaptersCompleted >= 1;
                case "chapter_3": return context.ChaptersCompleted >= 3;
                case "chapter_6": return context.ChaptersCompleted >= 6;
                case "speed_demon":
                    return context.FastestCorrectMs > 0 &&
                           context.FastestCorrectMs <= 3000;
                case "login_3": return context.LoginStreak >= 3;
                case "login_7": return context.LoginStreak >= 7;
                case "login_30": return context.LoginStreak >= 30;
                case "npc_friend": return context.NpcChats >= 10;
                default: return false;
            }
        }
    }
}
