using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Reports;
using WordQuest.Presentation.Controls;

namespace WordQuest.Presentation.Screens
{
    public sealed class ReportScreen
    {
        private readonly VisualElement view;
        private readonly ReportController controller;
        private readonly string wordbookId;
        private readonly CancellationToken token;
        private LearningReportViewModel report;

        public ReportScreen(
            VisualElement view,
            ReportController controller,
            string wordbookId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.wordbookId = wordbookId;
            this.token = token;
            view.Q<Button>("refresh-report-button").clicked += Load;
            view.Q<Button>("export-report-button").clicked += Export;
            Load();
        }

        private async void Load()
        {
            var status = view.Q<Label>("report-status-label");
            status.text = "正在汇总学习数据…";
            report = await controller.LoadAsync(wordbookId, token);
            view.Q<Label>("report-overview-label").text =
                $"答题 {report.Overview.totalQuizzes} 次 · 正确率 {report.Overview.correctRate}% · " +
                $"已学 {report.Overview.wordsLearned} 词 · 已掌握 {report.Overview.wordsMastered} 词 · " +
                $"学习 {report.Overview.totalStudyTime} 分钟";

            var dailySlot = view.Q<VisualElement>("daily-chart-slot");
            dailySlot.Clear();
            var dailyChart = new BarChartElement();
            dailyChart.SetData(report.Daily);
            dailySlot.Add(dailyChart);

            var chapterSlot = view.Q<VisualElement>("chapter-chart-slot");
            chapterSlot.Clear();
            var chapterChart = new BarChartElement();
            chapterChart.SetData(report.Chapters);
            chapterSlot.Add(chapterChart);

            var errorSlot = view.Q<VisualElement>("error-chart-slot");
            errorSlot.Clear();
            var errorChart = new BarChartElement();
            errorChart.SetData(report.ErrorTypes);
            errorSlot.Add(errorChart);
            var errorLegend = new VisualElement();
            errorLegend.AddToClassList("feature-grid");
            foreach (var point in report.ErrorTypes)
            {
                var label = new Label(
                    $"{ErrorTypeLabel(point.Label)} · {point.Value}");
                label.AddToClassList("list-card");
                errorLegend.Add(label);
            }
            errorSlot.Add(errorLegend);

            var heatmapSlot = view.Q<VisualElement>("heatmap-slot");
            heatmapSlot.Clear();
            var heatmap = new HeatmapElement();
            heatmap.SetData(report.Heatmap);
            heatmapSlot.Add(heatmap);

            var mistakes = view.Q<ScrollView>("mistake-list");
            mistakes.Clear();
            foreach (var item in report.Mistakes)
            {
                var row = new Label(
                    $"{item.word} · {item.meaning} · 错误 {item.wrongCount}/{item.totalCount}");
                row.AddToClassList("list-card");
                mistakes.Add(row);
            }

            status.text = report.Warnings.Count == 0
                ? "报告已更新"
                : string.Join("；", report.Warnings);
        }

        private void Export()
        {
            if (report == null)
                return;
            view.Q<Label>("report-status-label").text =
                $"已导出到 {ReportExporter.Export(report)}";
        }

        public static string ErrorTypeLabel(string value)
        {
            switch (value)
            {
                case "unknown": return "未知 / 正确";
                case "spelling_near": return "拼写接近";
                case "meaning_confusion": return "释义混淆";
                case "timeout": return "超时未答";
                case "pronunciation": return "发音问题";
                case "other": return "其他错因";
                default:
                    return string.IsNullOrWhiteSpace(value)
                        ? "未分类"
                        : value;
            }
        }
    }
}
