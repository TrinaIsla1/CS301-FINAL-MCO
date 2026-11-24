export function formatTime12(value) {
  const time = String(value || '').slice(0, 5)
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return time
  }

  const period = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`
}

export function formatTimeRange12(start, end) {
  return `${formatTime12(start)} - ${formatTime12(end)}`
}
