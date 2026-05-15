export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function canRecognizeSpeech() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function startSpeechRecognition({ lang = 'en-US', onResult, onError, onEnd } = {}) {
  if (!canRecognizeSpeech()) return null
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new Recognition()
  recognition.lang = lang
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  recognition.onresult = (event) => {
    const alternative = event.results?.[0]?.[0]
    const transcript = alternative?.transcript || ''
    const confidence = typeof alternative?.confidence === 'number' ? alternative.confidence : 0
    onResult?.(transcript, { confidence, raw: event.results?.[0] })
  }
  recognition.onerror = (event) => onError?.(event.error || 'recognition_error')
  recognition.onend = () => onEnd?.()
  recognition.start()
  return recognition
}

export function speakText(text, options = {}) {
  const content = String(text || '').trim()
  if (!content || !canSpeak()) return false

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = options.lang || 'en-US'
  utterance.rate = options.rate || 0.9
  utterance.pitch = options.pitch || 1
  window.speechSynthesis.speak(utterance)
  return true
}
