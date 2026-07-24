using UnityEngine;
using UnityEngine.InputSystem;

namespace WordQuest.Infrastructure.Input
{
    public sealed class GameInput
    {
        public bool UiHasFocus { get; set; }

        public Vector2 Move
        {
            get
            {
                if (UiHasFocus)
                    return Vector2.zero;

                var value = Vector2.zero;
                var keyboard = Keyboard.current;
                if (keyboard != null)
                {
                    if (keyboard.aKey.isPressed ||
                        keyboard.leftArrowKey.isPressed)
                        value.x -= 1f;
                    if (keyboard.dKey.isPressed ||
                        keyboard.rightArrowKey.isPressed)
                        value.x += 1f;
                    if (keyboard.sKey.isPressed ||
                        keyboard.downArrowKey.isPressed)
                        value.y -= 1f;
                    if (keyboard.wKey.isPressed ||
                        keyboard.upArrowKey.isPressed)
                        value.y += 1f;
                }

                if (Gamepad.current != null)
                    value += Gamepad.current.leftStick.ReadValue();

                return Vector2.ClampMagnitude(value, 1f);
            }
        }

        public bool InteractPressed =>
            !UiHasFocus &&
            ((Keyboard.current?.eKey.wasPressedThisFrame ?? false) ||
             (Keyboard.current?.spaceKey.wasPressedThisFrame ?? false) ||
             (Gamepad.current?.buttonSouth.wasPressedThisFrame ?? false));

        public bool PausePressed =>
            (Keyboard.current?.escapeKey.wasPressedThisFrame ?? false) ||
            (Gamepad.current?.startButton.wasPressedThisFrame ?? false);

        public bool CancelPressed =>
            (Keyboard.current?.escapeKey.wasPressedThisFrame ?? false) ||
            (Gamepad.current?.buttonEast.wasPressedThisFrame ?? false);
    }
}
