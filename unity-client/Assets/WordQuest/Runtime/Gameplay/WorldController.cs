using UnityEngine;
using WordQuest.Content;

namespace WordQuest.Gameplay
{
    public sealed class WorldController : MonoBehaviour
    {
        private GameObject generatedWorld;

        public void Build(LevelDefinition level, int seed)
        {
            if (generatedWorld != null)
                Destroy(generatedWorld);

            generatedWorld = WorldGenerator.Generate(
                level,
                ChapterTheme.ForChapter(level.Chapter),
                seed);
            generatedWorld.transform.SetParent(transform, false);
        }

        public void SetSimulationEnabled(bool enabled)
        {
            if (generatedWorld == null)
                return;

            foreach (var player in generatedWorld.GetComponentsInChildren<
                         PlayerController>())
                player.MovementEnabled = enabled;
            foreach (var encounter in generatedWorld.GetComponentsInChildren<
                         EncounterController>())
                encounter.SetActive(enabled);
        }
    }
}
