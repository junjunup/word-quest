using System;
using System.Threading;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Api.Dto;
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
        private readonly IDailyLearningService evidence;
        private int loadGeneration;

        public ReportScreen(
            VisualElement view,
            ReportController controller,
            string wordbookId,
            CancellationToken token, IDailyLearningService evidence = null)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.wordbookId = wordbookId;
            this.token = token;
            this.evidence = evidence;
            view.Q<Button>("refresh-report-button").clicked += Load;
            view.Q<Button>("export-report-button").clicked += Export;
            Load();
        }

        private async void Load()
        {
            var generation = ++loadGeneration;
            var status = view.Q<Label>("report-status-label");
            status.text = "正在汇总学习数据…";
            var loaded = await controller.LoadAsync(wordbookId, token);
            if (token.IsCancellationRequested || generation != loadGeneration) return;
            report = loaded;
            view.Q<Label>("report-overview-label").text =
                $"答题 {report.Overview.totalQuizzes} 次 · 全部练习正确率（含提示和纠正）{report.Overview.correctRate}% · " +
                $"练习涉及 {report.Overview.wordsLearned} 词 · " +
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
            if (evidence != null)
            {
                var result = await evidence.EvidenceAsync(wordbookId, token);
                if (token.IsCancellationRequested || generation != loadGeneration) return;
                view.Q<VisualElement>("learning-evidence")?.RemoveFromHierarchy();
                var panel = new VisualElement { name = "learning-evidence" };
                panel.AddToClassList("list-card");
                var overview = view.Q<Label>("report-overview-label");
                overview.parent.Insert(overview.parent.IndexOf(overview) + 1, panel);
                if (!result.IsSuccess || result.Data == null) panel.Add(new Label("学习证据暂不可用，请刷新重试。"));
                else
                {
                    var data = result.Data;
                    report.Evidence = data;
                    panel.Add(new Label("学习证据 · 不同答题方式分开统计"));
                    panel.Add(new Label(EvidenceLine("无提示首答精确回忆", data.recall)));
                    panel.Add(new Label(EvidenceLine("选项识别", data.recognition)));
                    panel.Add(new Label(EvidenceLine("提示后作答", data.assisted)));
                    panel.Add(new Label(EvidenceLine("看过答案后的纠正", data.correction)));
                    panel.Add(new Label($"历史未知记录 {data.unknown?.total ?? 0} 次，无法判断当时是否使用提示。"));
                    panel.Add(new Label($"已通过至少间隔 24 小时的无提示精确回忆：{data.delayedPassed} 词。持续记忆仍需后续复习。"));
                    var words = new ScrollView(); words.style.maxHeight = 200;
                    foreach (var word in data.words ?? Array.Empty<EvidenceWordDto>())
                        words.Add(new Label($"{word.word} · {(word.state == "delayed_passed" ? "已通过延迟复习" : word.state == "consolidate" ? "待巩固" : "刚接触")} · 下次 {WordQuestApp.ReviewDate(word.nextReviewAt)}"));
                    panel.Add(words);
                }
            }
        }

        private static string EvidenceLine(string label, EvidenceCountDto count) => count == null || count.total == 0
            ? label + "：数据不足"
            : $"{label}：{count.correct}/{count.total} 次";

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
