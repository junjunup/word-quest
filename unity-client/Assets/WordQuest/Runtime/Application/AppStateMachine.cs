using System;
using System.Collections.Generic;

namespace WordQuest.Application
{
    public enum AppState
    {
        Boot,
        Authentication,
        Home,
        Game,
        Result,
        Review,
        Endless,
        DailyChallenge,
        Reports,
        Vocabulary,
        Social,
        Profile,
        AiTutor
    }

    public sealed class AppStateMachine
    {
        private static readonly HashSet<AppState> FeatureStates =
            new HashSet<AppState>
            {
                AppState.Game,
                AppState.Review,
                AppState.Endless,
                AppState.DailyChallenge,
                AppState.Reports,
                AppState.Vocabulary,
                AppState.Social,
                AppState.Profile,
                AppState.AiTutor
            };

        private static readonly Dictionary<AppState, HashSet<AppState>> Allowed =
            new Dictionary<AppState, HashSet<AppState>>
            {
                {
                    AppState.Boot,
                    new HashSet<AppState>
                    {
                        AppState.Authentication,
                        AppState.Home
                    }
                },
                {
                    AppState.Authentication,
                    new HashSet<AppState> { AppState.Home }
                },
                {
                    AppState.Home,
                    new HashSet<AppState>
                    {
                        AppState.Game,
                        AppState.Review,
                        AppState.Endless,
                        AppState.DailyChallenge,
                        AppState.Reports,
                        AppState.Vocabulary,
                        AppState.Social,
                        AppState.Profile,
                        AppState.AiTutor,
                        AppState.Authentication
                    }
                },
                {
                    AppState.Game,
                    new HashSet<AppState>
                    {
                        AppState.Result,
                        AppState.Home,
                        AppState.Authentication
                    }
                },
                {
                    AppState.Result,
                    new HashSet<AppState>
                    {
                        AppState.Home,
                        AppState.Game,
                        AppState.Reports,
                        AppState.Authentication
                    }
                }
            };

        public AppState Current { get; private set; } = AppState.Boot;

        public event Action<AppState, AppState> Changed;

        public bool TryTransition(AppState next)
        {
            if (next == Current)
                return true;

            var allowed = Allowed.TryGetValue(Current, out var explicitStates) &&
                          explicitStates.Contains(next);
            if (!allowed && FeatureStates.Contains(Current))
            {
                allowed = next == AppState.Home ||
                          next == AppState.Authentication;
            }

            if (!allowed)
                return false;

            var previous = Current;
            Current = next;
            Changed?.Invoke(previous, next);
            return true;
        }
    }
}
