using System;
using System.Collections.Generic;
using System.Linq;
using WordQuest.Infrastructure.Api.Dto;
namespace WordQuest.Application
{
    public static class DailyLearningPlan
    {
        public static WordDto[] Remaining(DailyLearningSessionDto session)
        {
            var completed = new HashSet<string>(session?.completedWordIds ?? Array.Empty<string>());
            return (session?.items ?? Array.Empty<WordDto>()).Where(word =>
                !completed.Contains(string.IsNullOrEmpty(word._id) ? word.wordId : word._id)).ToArray();
        }
    }
}
