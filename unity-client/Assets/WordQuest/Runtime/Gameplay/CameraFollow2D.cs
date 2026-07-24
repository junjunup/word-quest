using UnityEngine;

namespace WordQuest.Gameplay
{
    [RequireComponent(typeof(Camera))]
    public sealed class CameraFollow2D : MonoBehaviour
    {
        private Transform target;
        private Rect bounds;
        private Vector3 velocity;

        public void Configure(Transform nextTarget, Rect worldBounds)
        {
            target = nextTarget;
            bounds = worldBounds;
            Snap();
        }

        private void LateUpdate()
        {
            if (target == null)
                return;

            var desired = Clamp(target.position);
            transform.position = Vector3.SmoothDamp(
                transform.position,
                desired,
                ref velocity,
                0.12f);
        }

        private void Snap()
        {
            if (target != null)
                transform.position = Clamp(target.position);
        }

        private Vector3 Clamp(Vector3 position)
        {
            var camera = GetComponent<Camera>();
            var halfHeight = camera.orthographicSize;
            var halfWidth = halfHeight * camera.aspect;
            var minX = bounds.xMin + halfWidth;
            var maxX = bounds.xMax - halfWidth;
            var minY = bounds.yMin + halfHeight;
            var maxY = bounds.yMax - halfHeight;
            return new Vector3(
                minX <= maxX
                    ? Mathf.Clamp(position.x, minX, maxX)
                    : bounds.center.x,
                minY <= maxY
                    ? Mathf.Clamp(position.y, minY, maxY)
                    : bounds.center.y,
                transform.position.z);
        }
    }
}
