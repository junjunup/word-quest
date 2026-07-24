using System;
using System.Collections.Generic;
using UnityEngine;

namespace WordQuest.Content
{
    public sealed class CharacterDefinition
    {
        public CharacterDefinition(
            int index,
            string name,
            Color tint,
            string description)
        {
            Index = index;
            Name = name;
            Tint = tint;
            Description = description;
        }

        public int Index { get; }
        public string Name { get; }
        public Color Tint { get; }
        public string Description { get; }
    }

    public static class CharacterCatalog
    {
        private static readonly CharacterDefinition[] Definitions =
        {
            New(0, "绿衣少年", "#FFFFFF", "田园勇者的经典装扮"),
            New(1, "红衣剑客", "#FF8888", "热情如火的冒险者"),
            New(2, "蓝衣法师", "#88AAFF", "冷静智慧的学者"),
            New(3, "紫衣贵族", "#CC88FF", "尊贵神秘的旅行者"),
            New(4, "橙衣商人", "#FFBB66", "精明能干的商贸达人"),
            New(5, "粉衣公主", "#FFAACC", "优雅美丽的冒险家"),
            New(6, "白衣圣者", "#EEEEFF", "纯洁无暇的守护者"),
            New(7, "金衣勇士", "#FFDD44", "荣耀闪耀的最强战士")
        };

        public static IReadOnlyList<CharacterDefinition> All => Definitions;

        public static CharacterDefinition Get(int index)
        {
            return Definitions[Math.Max(0, Math.Min(index, 7))];
        }

        private static CharacterDefinition New(
            int index,
            string name,
            string hex,
            string description)
        {
            ColorUtility.TryParseHtmlString(hex, out var color);
            return new CharacterDefinition(index, name, color, description);
        }
    }
}
