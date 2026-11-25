export const hm = (t) => String(t).slice(0, 5)
const toMin = (t) => parseInt(t, 10) * 60 + parseInt(String(t).slice(3, 5), 10)
const WEEK = 7 * 1440

// The class that starts soonest from now, wrapping around the week (Mon = 0).
export function nextClass(rows) {
  const now = new Date()
  const nowMin =
    ((now.getDay() + 6) % 7) * 1440 + now.getHours() * 60 + now.getMinutes()
  let best = null
  for (const s of rows) {
    let diff = (s.day_of_week - 1) * 1440 + toMin(s.start_time) - nowMin
    if (diff < 0) diff += WEEK
    if (!best || diff < best.diff) best = { s, diff }
  }
  return best?.s
}

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']
export const termOf = (s) => `${s.academic_year} · ${s.semester}`

// The most recent academic year and semester among the rows.
export function latestTerm(rows) {
  let best = null
  for (const s of rows) {
    const year = s.academic_year || ''
    const sem = SEMESTERS.indexOf(s.semester)
    if (!best || year > best.year || (year === best.year && sem > best.sem)) {
      best = { year, sem, term: termOf(s) }
    }
  }
  return best ? best.term : ''
}
