using System;
using UnityEngine;

namespace WordQuest.Gameplay
{
    [RequireComponent(typeof(SpriteRenderer))]
    public sealed class SpriteAnimationController : MonoBehaviour
    {
        private SpriteRenderer spriteRenderer;
        private Sprite[][] directions;
        private Sprite[] loopFrames;
        private int direction;
        private int frame;
        private float elapsed;
        private float framesPerSecond = 6f;
        private bool moving = true;

        public void ConfigureLoop(Sprite[] frames, float fps)
        {
            loopFrames = frames ?? Array.Empty<Sprite>();
            directions = null;
            framesPerSecond = Mathf.Max(1f, fps);
            frame = 0;
            ApplyFrame();
        }

        public void ConfigureDirectional(Sprite[] frames, float fps)
        {
            if (frames == null || frames.Length < 16)
                return;

            directions = new Sprite[4][];
            for (var row = 0; row < 4; row++)
            {
                directions[row] = new Sprite[4];
                Array.Copy(frames, row * 4, directions[row], 0, 4);
            }
            loopFrames = null;
            framesPerSecond = Mathf.Max(1f, fps);
            frame = 0;
            direction = 0;
            ApplyFrame();
        }

        public void SetMotion(Vector2 value)
        {
            moving = value.sqrMagnitude > 0.01f;
            if (Mathf.Abs(value.x) > Mathf.Abs(value.y))
                direction = value.x < 0f ? 2 : 3;
            else if (Mathf.Abs(value.y) > 0.01f)
                direction = value.y < 0f ? 0 : 1;
            if (!moving)
                frame = 0;
            ApplyFrame();
        }

        private void Awake()
        {
            spriteRenderer = GetComponent<SpriteRenderer>();
        }

        private void Update()
        {
            var frames = CurrentFrames;
            if (frames.Length <= 1 || (!moving && directions != null))
                return;

            elapsed += Time.deltaTime;
            if (elapsed < 1f / framesPerSecond)
                return;
            elapsed = 0f;
            frame = (frame + 1) % frames.Length;
            ApplyFrame();
        }

        private Sprite[] CurrentFrames =>
            directions == null
                ? loopFrames ?? Array.Empty<Sprite>()
                : directions[Mathf.Clamp(direction, 0, directions.Length - 1)];

        private void ApplyFrame()
        {
            if (spriteRenderer == null)
                spriteRenderer = GetComponent<SpriteRenderer>();
            var frames = CurrentFrames;
            if (frames.Length > 0)
                spriteRenderer.sprite = frames[Mathf.Clamp(
                    frame,
                    0,
                    frames.Length - 1)];
        }
    }
}
