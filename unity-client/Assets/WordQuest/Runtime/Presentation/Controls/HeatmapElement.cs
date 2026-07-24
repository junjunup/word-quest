using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application.Reports;

namespace WordQuest.Presentation.Controls
{
    public sealed class HeatmapElement : VisualElement
    {
        private IReadOnlyList<HeatmapDay> days = Array.Empty<HeatmapDay>();

        public HeatmapElement()
        {
            generateVisualContent += Draw;
            style.minHeight = 120;
        }

        public void SetData(IReadOnlyList<HeatmapDay> next)
        {
            days = next ?? Array.Empty<HeatmapDay>();
            MarkDirtyRepaint();
        }

        private void Draw(MeshGenerationContext context)
        {
            var painter = context.painter2D;
            const float size = 11f;
            const float gap = 3f;
            for (var index = 0; index < days.Count; index++)
            {
                var x = index / 7 * (size + gap);
                var y = index % 7 * (size + gap);
                var strength = Mathf.Clamp01(days[index].Count / 20f);
                painter.fillColor = Color.Lerp(
                    new Color(0.85f, 0.88f, 0.78f),
                    new Color(0.2f, 0.55f, 0.3f),
                    strength);
                painter.BeginPath();
                painter.MoveTo(new Vector2(x, y));
                painter.LineTo(new Vector2(x + size, y));
                painter.LineTo(new Vector2(x + size, y + size));
                painter.LineTo(new Vector2(x, y + size));
                painter.ClosePath();
                painter.Fill();
            }
        }
    }
}
