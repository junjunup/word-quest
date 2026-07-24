using NUnit.Framework;
using WordQuest.Application;

namespace WordQuest.Tests
{
    public sealed class AppStateMachineTests
    {
        [Test]
        public void Game_requires_authenticated_home()
        {
            var machine = new AppStateMachine();

            Assert.That(machine.TryTransition(AppState.Game), Is.False);
            Assert.That(machine.TryTransition(AppState.Authentication), Is.True);
            Assert.That(machine.TryTransition(AppState.Home), Is.True);
            Assert.That(machine.TryTransition(AppState.Game), Is.True);
        }

        [Test]
        public void Feature_can_return_home_or_authentication()
        {
            var machine = new AppStateMachine();
            machine.TryTransition(AppState.Home);
            machine.TryTransition(AppState.Reports);

            Assert.That(machine.TryTransition(AppState.Home), Is.True);
            Assert.That(machine.TryTransition(AppState.Profile), Is.True);
            Assert.That(machine.TryTransition(AppState.Authentication), Is.True);
        }

        [Test]
        public void Result_is_reachable_only_from_game()
        {
            var machine = new AppStateMachine();
            machine.TryTransition(AppState.Home);

            Assert.That(machine.TryTransition(AppState.Result), Is.False);
            Assert.That(machine.TryTransition(AppState.Game), Is.True);
            Assert.That(machine.TryTransition(AppState.Result), Is.True);
        }
    }
}
