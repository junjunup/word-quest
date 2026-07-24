using UnityEngine;

namespace WordQuest.Content
{
    public sealed class ChapterTheme
    {
        private ChapterTheme(
            int chapter,
            string name,
            Color ground,
            Color accent,
            Color danger)
        {
            Chapter = chapter;
            Name = name;
            Ground = ground;
            Accent = accent;
            Danger = danger;
        }

        public int Chapter { get; }
        public string Name { get; }
        public Color Ground { get; }
        public Color Accent { get; }
        public Color Danger { get; }

        public static ChapterTheme ForChapter(int chapter)
        {
            switch (chapter)
            {
                case 2:
                    return new ChapterTheme(
                        2,
                        "雾林",
                        Hex("#345C4A"),
                        Hex("#8FCB9B"),
                        Hex("#D66B5D"));
                case 3:
                    return new ChapterTheme(
                        3,
                        "商贸城",
                        Hex("#5E4935"),
                        Hex("#E1B84B"),
                        Hex("#B9504D"));
                case 4:
                    return new ChapterTheme(
                        4,
                        "冰原",
                        Hex("#4F7382"),
                        Hex("#B8E1E8"),
                        Hex("#D56865"));
                case 5:
                    return new ChapterTheme(
                        5,
                        "星夜峡谷",
                        Hex("#303A5C"),
                        Hex("#AA9DE3"),
                        Hex("#E16A74"));
                case 6:
                    return new ChapterTheme(
                        6,
                        "知识圣殿",
                        Hex("#514638"),
                        Hex("#E6C968"),
                        Hex("#C95D4A"));
                default:
                    return new ChapterTheme(
                        1,
                        "新芽平原",
                        Hex("#456B45"),
                        Hex("#A9D66F"),
                        Hex("#C6594B"));
            }
        }

        private static Color Hex(string value)
        {
            return ColorUtility.TryParseHtmlString(value, out var color)
                ? color
                : Color.white;
        }
    }
}
