using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Infrastructure.Audio
{
    public enum MusicId
    {
        Menu,
        Game,
        Result
    }

    public enum SoundId
    {
        Correct,
        Wrong,
        BossAppear,
        BossDefeat,
        Combo,
        Coin,
        LevelComplete,
        Click
    }

    public sealed class AudioService : IDisposable
    {
        private const string VolumeKey = "wordquest:audio-volume";
        private const string MutedKey = "wordquest:audio-muted";
        private readonly IKeyValueStore store;
        private readonly GameObject owner;
        private readonly AudioSource music;
        private readonly AudioSource effects;
        private MusicId? currentMusic;

        public AudioService(IKeyValueStore store)
        {
            this.store = store ?? throw new ArgumentNullException(nameof(store));
            owner = new GameObject("WordQuest Audio");
            UnityEngine.Object.DontDestroyOnLoad(owner);
            music = owner.AddComponent<AudioSource>();
            effects = owner.AddComponent<AudioSource>();
            music.loop = true;
            Volume = ParseVolume(store.GetString(VolumeKey, "0.8"));
            Muted = store.GetString(MutedKey, "false") == "true";
            Apply();
        }

        public float Volume { get; private set; }
        public bool Muted { get; private set; }

        public async Task PlayMusicAsync(
            MusicId id,
            CancellationToken token)
        {
            if (currentMusic == id && music.isPlaying)
                return;

            var path = $"Audio/bgm/{id.ToString().ToLowerInvariant()}";
            var request = Resources.LoadAsync<AudioClip>(path);
            while (!request.isDone)
            {
                token.ThrowIfCancellationRequested();
                await Task.Yield();
            }

            var clip = request.asset as AudioClip;
            if (clip == null)
                return;

            music.Stop();
            music.clip = clip;
            music.Play();
            currentMusic = id;
        }

        public void Play(SoundId id)
        {
            var clip = Resources.Load<AudioClip>(
                $"Audio/{ToResourceName(id)}");
            if (clip != null)
                effects.PlayOneShot(clip);
        }

        public void SetVolume(float value)
        {
            Volume = Mathf.Clamp01(value);
            store.SetString(
                VolumeKey,
                Volume.ToString(System.Globalization.CultureInfo.InvariantCulture));
            store.Save();
            Apply();
        }

        public void ToggleMute()
        {
            Muted = !Muted;
            store.SetString(MutedKey, Muted ? "true" : "false");
            store.Save();
            Apply();
        }

        public void Dispose()
        {
            if (owner != null)
                UnityEngine.Object.Destroy(owner);
        }

        private void Apply()
        {
            music.mute = Muted;
            effects.mute = Muted;
            music.volume = Volume;
            effects.volume = Volume;
        }

        private static float ParseVolume(string value)
        {
            return float.TryParse(
                value,
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture,
                out var parsed)
                ? Mathf.Clamp01(parsed)
                : 0.8f;
        }

        private static string ToResourceName(SoundId id)
        {
            switch (id)
            {
                case SoundId.BossAppear: return "boss_appear";
                case SoundId.BossDefeat: return "boss_defeat";
                case SoundId.LevelComplete: return "level_complete";
                default: return id.ToString().ToLowerInvariant();
            }
        }
    }
}
