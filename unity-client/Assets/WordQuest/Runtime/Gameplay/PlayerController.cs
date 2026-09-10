using UnityEngine;
using WordQuest.Infrastructure.Input;

namespace WordQuest.Gameplay
{
    [RequireComponent(typeof(Rigidbody2D))]
    public sealed class PlayerController : MonoBehaviour
    {
        [SerializeField] private float speed = 4.5f;
        private Rigidbody2D body;
        private GameInput input;
        private SpriteAnimationController animationController;

        private bool movementEnabled = true;
        public bool MovementEnabled
        {
            get => movementEnabled;
            set
            {
                movementEnabled = value;
                if (!value) input?.RequireNeutral();
                if (!value && body != null)
                {
                    body.linearVelocity = Vector2.zero;
                    animationController?.SetMotion(Vector2.zero);
                }
            }
        }

        public void Configure(GameInput gameInput)
        {
            input = gameInput;
        }

        private void Awake()
        {
            body = GetComponent<Rigidbody2D>();
            body.gravityScale = 0f;
            body.freezeRotation = true;
            animationController =
                GetComponent<SpriteAnimationController>();
        }

        private void FixedUpdate()
        {
            var velocity = MovementEnabled && input != null
                ? input.Move * speed
                : Vector2.zero;
            body.linearVelocity = velocity;
            animationController?.SetMotion(velocity);
        }
    }
}
