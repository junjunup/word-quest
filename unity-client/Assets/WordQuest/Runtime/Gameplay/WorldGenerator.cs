using System;
using System.Collections.Generic;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Infrastructure.Input;
using Random = System.Random;

namespace WordQuest.Gameplay
{
    public static class WorldGenerator
    {
        private static Sprite markerSprite;
        private static readonly Dictionary<string, Sprite[]> FrameCache =
            new Dictionary<string, Sprite[]>();
        private const string CharacterPath =
            "Art/SproutLands/Sprout Lands - Sprites - Basic pack/Characters/Basic Charakter Spritesheet";
        private const string ChickenPath =
            "Art/SproutLands/Sprout Lands - Sprites - Basic pack/Characters/Free Chicken Sprites";
        private const string CowPath =
            "Art/SproutLands/Sprout Lands - Sprites - Basic pack/Characters/Free Cow Sprites";
        private const string DecorationPath =
            "Art/SproutLands/Sprout Lands - Sprites - Basic pack/Objects/Basic Grass Biom things 1";

        public static GameObject Generate(
            LevelDefinition level,
            ChapterTheme theme,
            int seed,
            Color? playerTint = null,
            Difficulty difficulty = null)
        {
            if (level == null)
                throw new ArgumentNullException(nameof(level));
            if (theme == null)
                throw new ArgumentNullException(nameof(theme));

            var root = new GameObject(
                $"World {level.Chapter}-{level.Id}");
            var random = new Random(seed);

            var ground = CreateMarker(
                "Ground",
                Vector2.zero,
                theme.Ground,
                root.transform,
                new Vector2(28f, 18f),
                null);
            ground.GetComponent<SpriteRenderer>().sortingOrder = -10;
            AddDecorations(
                root.transform,
                random,
                theme,
                level.Chapter);

            var playerFrames = LoadFrames(CharacterPath, 48, 48);
            var player = CreateMarker(
                "Player",
                new Vector2(-6f, 0f),
                playerTint ?? Color.white,
                root.transform,
                Vector2.one,
                Frame(playerFrames, 0));
            var playerBody = player.AddComponent<Rigidbody2D>();
            playerBody.gravityScale = 0;
            var playerCollider = player.AddComponent<CircleCollider2D>();
            playerCollider.radius = 0.35f;
            var playerAnimation =
                player.AddComponent<SpriteAnimationController>();
            playerAnimation.ConfigureDirectional(playerFrames, 10f);
            var playerController = player.AddComponent<PlayerController>();
            playerController.Configure(new GameInput());

            var cowFrames = LoadFrames(CowPath, 32, 32);
            var npc = CreateMarker(
                "Guide NPC",
                new Vector2(-3f, 3f),
                Color.white,
                root.transform,
                Vector2.one * 1.2f,
                Frame(cowFrames, 0));
            npc.AddComponent<SpriteAnimationController>()
                .ConfigureLoop(FirstFrames(cowFrames, 3), 3f);
            AddEncounter(npc, "guide", EncounterKind.Npc);

            difficulty = difficulty ??
                         Difficulty.For(DifficultyKind.Normal);
            var baseMonsterCount = Math.Min(level.WordsCount, 10);
            var monsterCount = difficulty.MonsterCount(baseMonsterCount);
            var chickenFrames = LoadFrames(ChickenPath, 16, 16);
            for (var index = 0; index < monsterCount; index++)
            {
                var position = NextPosition(random, new Vector2(-6f, 0f));
                var monster = CreateMarker(
                    $"Monster {index + 1}",
                    position,
                    Color.Lerp(theme.Danger, theme.Accent, index / 16f),
                    root.transform,
                    Vector2.one * 1.4f,
                    Frame(chickenFrames, index % 4));
                monster.AddComponent<SpriteAnimationController>()
                    .ConfigureLoop(FirstFrames(chickenFrames, 4), 4f);
                AddEncounter(
                    monster,
                    $"monster-{index + 1}",
                    EncounterKind.Monster);
            }

            if (level.Boss != null && !level.IsTutorial)
            {
                var boss = CreateMarker(
                    "Boss",
                    new Vector2(7f, 0f),
                    theme.Danger,
                    root.transform,
                    Vector2.one * 1.7f,
                    Frame(cowFrames, 0));
                boss.AddComponent<SpriteAnimationController>()
                    .ConfigureLoop(FirstFrames(cowFrames, 3), 3f);
                AddEncounter(boss, "boss", EncounterKind.Boss);
            }

            CreateBounds(root.transform);
            var camera = Camera.main;
            if (camera != null)
            {
                var follow = camera.GetComponent<CameraFollow2D>() ??
                             camera.gameObject.AddComponent<CameraFollow2D>();
                follow.Configure(player.transform, new Rect(-14f, -9f, 28f, 18f));
            }
            return root;
        }

        private static void AddDecorations(
            Transform root,
            Random random,
            ChapterTheme theme,
            int chapter)
        {
            var host = new GameObject("Decorations");
            host.transform.SetParent(root, false);
            var frames = LoadFrames(DecorationPath, 16, 16);
            var treeCount = TreeCount(chapter);
            for (var index = 0; index < treeCount; index++)
            {
                var position = NextDecorationPosition(random);
                var pink = (index + chapter) % 3 == 0;
                AddTree(
                    host.transform,
                    frames,
                    position,
                    pink,
                    index);
            }

            var frameChoices = DecorationFrames(chapter);
            var decorationCount = 14 + chapter * 2;
            for (var index = 0; index < decorationCount; index++)
            {
                var position = NextDecorationPosition(random);
                var frameIndex =
                    frameChoices[index % frameChoices.Length];
                var decoration = CreateMarker(
                    $"Decoration {index + 1}",
                    position,
                    Color.Lerp(Color.white, theme.Accent, 0.12f),
                    host.transform,
                    Vector2.one,
                    Frame(frames, frameIndex));
                decoration.GetComponent<SpriteRenderer>().sortingOrder = -2;
            }
        }

        private static void AddTree(
            Transform parent,
            Sprite[] frames,
            Vector2 position,
            bool pink,
            int index)
        {
            var tree = new GameObject($"Tree {index + 1}");
            tree.transform.SetParent(parent, false);
            tree.transform.position = position;
            var firstFrame = pink ? 3 : 0;
            for (var row = 0; row < 2; row++)
            {
                for (var column = 0; column < 3; column++)
                {
                    var frameIndex =
                        firstFrame + row * 9 + column;
                    var part = CreateMarker(
                        $"Part {row}-{column}",
                        new Vector2(
                            position.x + column - 1f,
                            position.y + 0.5f - row),
                        Color.white,
                        parent,
                        Vector2.one * 1.3f,
                        Frame(frames, frameIndex));
                    part.transform.SetParent(tree.transform, true);
                    part.GetComponent<SpriteRenderer>().sortingOrder = -1;
                }
            }
        }

        private static Vector2 NextDecorationPosition(Random random)
        {
            for (var attempt = 0; attempt < 20; attempt++)
            {
                var position = new Vector2(
                    (float)(random.NextDouble() * 22d - 11d),
                    (float)(random.NextDouble() * 14d - 7d));
                if (Vector2.Distance(position, new Vector2(-6f, 0f)) >= 2.5f &&
                    Vector2.Distance(position, new Vector2(-3f, 3f)) >= 2f)
                    return position;
            }

            return new Vector2(0f, 6f);
        }

        private static int TreeCount(int chapter)
        {
            switch (chapter)
            {
                case 2: return 7;
                case 3: return 2;
                case 4: return 3;
                case 5: return 0;
                case 6: return 5;
                default: return 4;
            }
        }

        private static int[] DecorationFrames(int chapter)
        {
            switch (chapter)
            {
                case 2:
                    return new[] { 15, 16, 18, 19, 20, 21, 27, 28, 29 };
                case 3:
                    return new[] { 17, 21, 22, 23, 24, 25 };
                case 4:
                    return new[] { 6, 7, 15, 21, 22, 23 };
                case 5:
                    return new[] { 21, 22, 23 };
                case 6:
                    return new[] { 6, 8, 15, 17, 18, 21, 24, 27 };
                default:
                    return new[] { 6, 7, 8, 15, 17, 18, 24, 25, 27, 28 };
            }
        }

        private static Vector2 NextPosition(Random random, Vector2 player)
        {
            for (var attempt = 0; attempt < 30; attempt++)
            {
                var value = new Vector2(
                    (float)(random.NextDouble() * 18d - 9d),
                    (float)(random.NextDouble() * 12d - 6d));
                if (Vector2.Distance(value, player) >= 2.5f)
                    return value;
            }

            return new Vector2(4f, 4f);
        }

        private static GameObject CreateMarker(
            string name,
            Vector2 position,
            Color color,
            Transform parent,
            Vector2 scale,
            Sprite sprite)
        {
            var marker = new GameObject(name);
            marker.transform.SetParent(parent, false);
            marker.transform.position = position;
            marker.transform.localScale = scale;
            var renderer = marker.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite ?? MarkerSprite;
            renderer.color = color;
            return marker;
        }

        private static Sprite[] LoadFrames(
            string resourcePath,
            int frameWidth,
            int frameHeight)
        {
            var key = $"{resourcePath}:{frameWidth}x{frameHeight}";
            if (FrameCache.TryGetValue(key, out var cached))
                return cached;

            var texture = Resources.Load<Texture2D>(resourcePath);
            if (texture == null)
                return Array.Empty<Sprite>();
            texture.filterMode = FilterMode.Point;
            var columns = texture.width / frameWidth;
            var rows = texture.height / frameHeight;
            var frames = new Sprite[columns * rows];
            for (var row = 0; row < rows; row++)
            {
                for (var column = 0; column < columns; column++)
                {
                    var index = row * columns + column;
                    frames[index] = Sprite.Create(
                        texture,
                        new Rect(
                            column * frameWidth,
                            texture.height - (row + 1) * frameHeight,
                            frameWidth,
                            frameHeight),
                        new Vector2(0.5f, 0.5f),
                        16f);
                    frames[index].name = $"{texture.name}_{index}";
                }
            }
            FrameCache[key] = frames;
            return frames;
        }

        private static Sprite Frame(Sprite[] frames, int index)
        {
            return frames != null && frames.Length > index
                ? frames[index]
                : null;
        }

        private static Sprite[] FirstFrames(Sprite[] frames, int count)
        {
            if (frames == null || frames.Length == 0)
                return Array.Empty<Sprite>();
            var length = Math.Min(frames.Length, count);
            var result = new Sprite[length];
            Array.Copy(frames, result, length);
            return result;
        }

        private static void CreateBounds(Transform parent)
        {
            AddBoundary(parent, "North Boundary", new Vector2(0f, 9.5f),
                new Vector2(29f, 1f));
            AddBoundary(parent, "South Boundary", new Vector2(0f, -9.5f),
                new Vector2(29f, 1f));
            AddBoundary(parent, "West Boundary", new Vector2(-14.5f, 0f),
                new Vector2(1f, 19f));
            AddBoundary(parent, "East Boundary", new Vector2(14.5f, 0f),
                new Vector2(1f, 19f));
        }

        private static void AddBoundary(
            Transform parent,
            string name,
            Vector2 position,
            Vector2 size)
        {
            var boundary = new GameObject(name);
            boundary.transform.SetParent(parent, false);
            boundary.transform.position = position;
            boundary.AddComponent<BoxCollider2D>().size = size;
        }

        private static void AddEncounter(
            GameObject target,
            string id,
            EncounterKind kind)
        {
            var collider = target.AddComponent<CircleCollider2D>();
            collider.isTrigger = true;
            var encounter = target.AddComponent<EncounterController>();
            encounter.Configure(id, kind);
        }

        private static Sprite MarkerSprite
        {
            get
            {
                if (markerSprite != null)
                    return markerSprite;

                var texture = new Texture2D(1, 1)
                {
                    name = "Runtime Marker Texture",
                    filterMode = FilterMode.Point
                };
                texture.SetPixel(0, 0, Color.white);
                texture.Apply();
                markerSprite = Sprite.Create(
                    texture,
                    new Rect(0, 0, 1, 1),
                    new Vector2(0.5f, 0.5f),
                    1f);
                markerSprite.name = "Runtime Marker Sprite";
                return markerSprite;
            }
        }
    }
}
