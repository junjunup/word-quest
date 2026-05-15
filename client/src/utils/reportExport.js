function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function exportLearningReportJSON(payload) {
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(`word-quest-report-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
}

export function exportLearningReportCSV({ dailyData = [], chapterData = [] }) {
  const lines = []
  lines.push('type,date_or_chapter,total,correct_or_rate,avg_time')
  for (const item of dailyData) {
    lines.push(['daily', item._id, item.total, item.correct, item.avgTime].map(csvEscape).join(','))
  }
  for (const item of chapterData) {
    lines.push(['chapter', item.chapter, item.total, item.correctRate, ''].map(csvEscape).join(','))
  }
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(`word-quest-report-${stamp}.csv`, lines.join('\n'), 'text/csv;charset=utf-8')
}

export function printLearningReport() {
  window.print()
}
