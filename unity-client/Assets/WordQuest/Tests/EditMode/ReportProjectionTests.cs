using System.Collections.Generic;
using NUnit.Framework;
using WordQuest.Application.Reports;
using WordQuest.Presentation.Screens;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Tests
{
    public sealed class ReportProjectionTests
    {
        [Test]
        public void Empty_report_is_zero_safe()
        {
            var points = ReportProjection.Daily(null);

            Assert.That(points, Is.Empty);
            Assert.That(ReportProjection.Percent(0, 0), Is.EqualTo(0));
        }

        [Test]
        public void Daily_projection_keeps_stable_date_labels()
        {
            var rows = new List<DailyStatDto>();
            for (var day = 1; day <= 30; day++)
            {
                rows.Add(new DailyStatDto
                {
                    _id = $"2026-07-{day:00}",
                    total = day,
                    correct = day / 2
                });
            }

            var points = ReportProjection.Daily(rows);

            Assert.That(points, Has.Count.EqualTo(30));
            Assert.That(points[0].Label, Is.EqualTo("07-01"));
            Assert.That(points[29].Label, Is.EqualTo("07-30"));
        }

        [Test]
        public void Csv_escaping_follows_rfc_4180()
        {
            Assert.That(
                ReportExporter.Escape("a,\"b\"\nc"),
                Is.EqualTo("\"a,\"\"b\"\"\nc\""));
        }

        [Test]
        public void Csv_contains_error_type_section()
        {
            var report = new LearningReportViewModel
            {
                ErrorTypes = new[]
                {
                    new ChartPoint
                    {
                        Label = "spelling",
                        Value = 3
                    }
                }
            };

            Assert.That(
                ReportExporter.ToCsv(report),
                Does.Contain("errorType,spelling,3"));
        }

        [Test]
        public void Error_type_legend_uses_readable_labels()
        {
            Assert.That(
                ReportScreen.ErrorTypeLabel("meaning_confusion"),
                Is.EqualTo("释义混淆"));
            Assert.That(
                ReportScreen.ErrorTypeLabel("spelling_near"),
                Is.EqualTo("拼写接近"));
        }
    }
}
