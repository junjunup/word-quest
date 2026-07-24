using System;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Infrastructure.Input;
using Random = System.Random;

namespace WordQuest.Gameplay
{
    public static class WorldGenerator
    {
        private static Sprite markerSprite;

        public static GameObject Generate(
            LevelDefinition level,
            ChapterTheme theme,
            int seed)
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
                new Vector2(28f, 18f));
            ground.GetComponent<SpriteRenderer>().sortingOrder = -10;

            var player = CreateMarker(
                "Player",
                new Vector2(-6f, 0f),
                theme.Accent,
                root.transform,
                new Vector2(0.8f, 0.8f));
            var playerBody = player.AddComponent<Rigidbody2D>();
            playerBody.gravityScale = 0;
            player.AddComponent<CircleCollider2D>();
            var playerController = player.AddComponent<PlayerController>();
            playerController.Configure(new GameInput());

            var npc = CreateMarker(
                "Guide NPC",
                new Vector2(-3f, 3f),
                Color.white,
                root.transform,
                new Vector2(0.8f, 0.8f));
            AddEncounter(npc, "guide", EncounterKind.Npc);

            var monsterCount = Math.Max(1, Math.Min(level.WordsCount / 5, 12));
            for (var index = 0; index < monsterCount; index++)
            {
                var position = NextPosition(random, new Vector2(-6f, 0f));
                var monster = CreateMarker(
                    $"Monster {index + 1}",
                    position,
                    Color.Lerp(theme.Danger, theme.Accent, index / 16f),
                    root.transform,
                    new Vector2(0.75f, 0.75f));
                AddEncounter(
                    monster,
                    $"monster-{index + 1}",
                    EncounterKind.Monster);
            }

            if (level.Boss != null)
            {
                var boss = CreateMarker(
                    "Boss",
                    new Vector2(7f, 0f),
                    theme.Danger,
                    root.transform,
                    new Vector2(1.5f, 1.5f));
                AddEncounter(boss, "boss", EncounterKind.Boss);
            }

            return root;
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
            Vector2 scale)
        {
            var marker = new GameObject(name);
            marker.transform.SetParent(parent, false);
            marker.transform.position = position;
            marker.transform.localScale = scale;
            var renderer = marker.AddComponent<SpriteRenderer>();
            renderer.sprite = MarkerSprite;
            renderer.color = color;
            return marker;
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
