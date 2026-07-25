using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

namespace WordQuest.Application.Reports
{
    public static class ReportExporter
    {
        public static string Export(LearningReportViewModel report)
        {
            if (report == null)
                throw new ArgumentNullException(nameof(report));

            var directory = Path.Combine(
                UnityEngine.Application.persistentDataPath,
                "Exports");
            Directory.CreateDirectory(directory);
            var path = Path.Combine(
                directory,
                $"word-quest-report-{DateTime.Now:yyyyMMdd-HHmmss}.csv");
            File.WriteAllText(path, ToCsv(report), new UTF8Encoding(true));
            return path;
        }

        public static string ToCsv(LearningReportViewModel report)
        {
            var rows = new List<string>
            {
                "section,label,value,secondary",
                $"overview,totalQuizzes,{report.Overview.totalQuizzes},",
                $"overview,correctRate,{Escape(report.Overview.correctRate)},",
                $"overview,wordsLearned,{report.Overview.wordsLearned},",
                $"overview,wordsMastered,{report.Overview.wordsMastered},",
                $"overview,totalStudyTimeMinutes,{report.Overview.totalStudyTime},"
            };
            foreach (var point in report.Daily)
            {
                rows.Add(
                    $"daily,{Escape(point.Label)},{point.Value},{point.SecondaryValue}");
            }
            foreach (var point in report.Chapters)
            {
                rows.Add(
                    $"chapter,{Escape(point.Label)},{point.Value},{point.SecondaryValue}");
            }
            foreach (var point in report.ErrorTypes)
            {
                rows.Add(
                    $"errorType,{Escape(point.Label)},{point.Value},{point.SecondaryValue}");
            }
            foreach (var mistake in report.Mistakes)
            {
                rows.Add(
                    $"mistake,{Escape(mistake.word)},{mistake.wrongCount},{mistake.errorRate}");
            }

            return string.Join("\r\n", rows) + "\r\n";
        }

        public static string Escape(string value)
        {
            value = value ?? string.Empty;
            if (value.IndexOfAny(new[] { ',', '"', '\r', '\n' }) < 0)
                return value;
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
    }
}
