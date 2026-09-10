using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Application.Reports
{
    public sealed class ChartPoint
    {
        public string Label { get; set; }
        public float Value { get; set; }
        public float SecondaryValue { get; set; }
    }

    public sealed class HeatmapDay
    {
        public string Date { get; set; }
        public int Count { get; set; }
    }

    public sealed class LearningReportViewModel
    {
        public LearningEvidenceDto Evidence { get; set; }
        public LearningStatsDto Overview { get; set; } = new LearningStatsDto();
        public IReadOnlyList<ChartPoint> Daily { get; set; } =
            Array.Empty<ChartPoint>();
        public IReadOnlyList<ChartPoint> Chapters { get; set; } =
            Array.Empty<ChartPoint>();
        public IReadOnlyList<ChartPoint> ErrorTypes { get; set; } =
            Array.Empty<ChartPoint>();
        public IReadOnlyList<MistakeDto> Mistakes { get; set; } =
            Array.Empty<MistakeDto>();
        public IReadOnlyList<HeatmapDay> Heatmap { get; set; } =
            Array.Empty<HeatmapDay>();
        public IReadOnlyList<string> Warnings { get; set; } =
            Array.Empty<string>();
    }

    public static class ReportProjection
    {
        public static IReadOnlyList<ChartPoint> Daily(
            IReadOnlyList<DailyStatDto> rows)
        {
            if (rows == null)
                return Array.Empty<ChartPoint>();

            return rows.Select(row => new ChartPoint
            {
                Label = string.IsNullOrEmpty(row._id) || row._id.Length < 5
                    ? row._id ?? string.Empty
                    : row._id.Substring(row._id.Length - 5),
                Value = row.total,
                SecondaryValue = Percent(row.correct, row.total)
            }).ToArray();
        }

        public static float Percent(float value, float total)
        {
            return total <= 0 ? 0f : Math.Max(0f, value / total * 100f);
        }
    }

    public sealed class ReportController
    {
        private readonly ILearningService learning;

        public ReportController(ILearningService learning)
        {
            this.learning = learning ??
                            throw new ArgumentNullException(nameof(learning));
        }

        public async Task<LearningReportViewModel> LoadAsync(
            string wordbookId,
            CancellationToken token)
        {
            var overviewTask = learning.GetStatsAsync(wordbookId, token);
            var dailyTask = learning.GetDailyStatsAsync(30, token);
            var chaptersTask = learning.GetChapterStatsAsync(token);
            var mistakesTask = learning.GetTopMistakesAsync(10, token);
            var errorsTask = learning.GetErrorTypesAsync(
                wordbookId,
                30,
                token);
            var heatmapTask = learning.GetHeatmapAsync(
                DateTime.UtcNow.Year,
                token);

            await Task.WhenAll(
                overviewTask,
                dailyTask,
                chaptersTask,
                mistakesTask,
                errorsTask,
                heatmapTask);

            var warnings = new List<string>();
            var overview = await overviewTask;
            var daily = await dailyTask;
            var chapters = await chaptersTask;
            var mistakes = await mistakesTask;
            var errors = await errorsTask;
            var heatmap = await heatmapTask;

            AddWarning(overview.IsSuccess, "学习概览暂时不可用", warnings);
            AddWarning(daily.IsSuccess, "每日趋势暂时不可用", warnings);
            AddWarning(chapters.IsSuccess, "章节统计暂时不可用", warnings);
            AddWarning(mistakes.IsSuccess, "易错词暂时不可用", warnings);
            AddWarning(errors.IsSuccess, "错因统计暂时不可用", warnings);
            AddWarning(heatmap.IsSuccess, "学习热力图暂时不可用", warnings);

            return new LearningReportViewModel
            {
                Overview = overview.Data ?? new LearningStatsDto(),
                Daily = ReportProjection.Daily(daily.Data),
                Chapters = (chapters.Data ?? Array.Empty<ChapterStatDto>())
                    .Select(row => new ChartPoint
                    {
                        Label = $"第{row.chapter}章",
                        Value = float.TryParse(row.correctRate, out var value)
                            ? value
                            : 0f,
                        SecondaryValue = row.total
                    })
                    .ToArray(),
                Mistakes = mistakes.Data ?? Array.Empty<MistakeDto>(),
                ErrorTypes = (errors.Data?.errorTypes ??
                              Array.Empty<ErrorTypeCountDto>())
                    .Select(row => new ChartPoint
                    {
                        Label = row.errorType,
                        Value = row.count
                    })
                    .ToArray(),
                Heatmap = (heatmap.Data ?? Array.Empty<HeatmapEntryDto>())
                    .Select(row => new HeatmapDay
                    {
                        Date = row.date,
                        Count = row.count
                    })
                    .ToArray(),
                Warnings = warnings.AsReadOnly()
            };
        }

        private static void AddWarning(
            bool success,
            string message,
            ICollection<string> warnings)
        {
            if (!success)
                warnings.Add(message);
        }
    }
}
