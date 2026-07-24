using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application.Reports;

namespace WordQuest.Presentation.Controls
{
    public sealed class BarChartElement : VisualElement
    {
        private IReadOnlyList<ChartPoint> points = Array.Empty<ChartPoint>();

        public BarChartElement()
        {
            generateVisualContent += Draw;
            style.minHeight = 220;
        }

        public void SetData(IReadOnlyList<ChartPoint> next)
        {
            points = next ?? Array.Empty<ChartPoint>();
            MarkDirtyRepaint();
        }

        private void Draw(MeshGenerationContext context)
        {
            if (points.Count == 0)
                return;

            var painter = context.painter2D;
            var maximum = Math.Max(1f, points.Max(point => point.Value));
            var width = contentRect.width / points.Count;
            for (var index = 0; index < points.Count; index++)
            {
                var height = contentRect.height * 0.82f *
                             points[index].Value / maximum;
                var left = index * width + width * 0.15f;
                var right = (index + 1) * width - width * 0.15f;
                var bottom = contentRect.height - 18f;
                painter.fillColor = new Color(0.25f, 0.52f, 0.33f, 1f);
                painter.BeginPath();
                painter.MoveTo(new Vector2(left, bottom));
                painter.LineTo(new Vector2(left, bottom - height));
                painter.LineTo(new Vector2(right, bottom - height));
                painter.LineTo(new Vector2(right, bottom));
                painter.ClosePath();
                painter.Fill();
            }
        }
    }
}
