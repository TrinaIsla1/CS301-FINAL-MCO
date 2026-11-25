import React, { useMemo, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { useResource } from '../hooks/useResource'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Timetable from '../components/Timetable'
import { Banner, Btn, Card, H1, H2, Muted, Select } from '../components/ui'
import { hm, latestTerm, nextClass, termOf } from '../lib/schedule'
import { C, DAYS, FONT } from '../theme'

const today = () => {
  const d = new Date().getDay()
  return d === 0 ? 1 : d
}

// The signed-in student's own schedule. There is nothing to search or select: the API looks up the
// linked student record and returns only the published classes of that student's section.
export default function StudentScheduleScreen() {
  const { profile } = useAuth()
  const mobile = useIsMobile()
  const r = useResource('/api/schedules', { sort: 'day_of_week' })
  const [pickedTerm, setPickedTerm] = useState('')
  const [day, setDay] = useState(today())
  const [highlight, setHighlight] = useState(null)

  const student = profile?.student
  const terms = useMemo(
    () => [...new Set(r.data.map(termOf))].sort().reverse(),
    [r.data],
  )
  const term = pickedTerm && terms.includes(pickedTerm) ? pickedTerm : latestTerm(r.data)
  const rows = useMemo(
    () =>
      r.data
        .filter((s) => termOf(s) === term)
        .sort(
          (a, b) =>
            a.day_of_week - b.day_of_week ||
            String(a.start_time).localeCompare(String(b.start_time)),
        ),
    [r.data, term],
  )
  const next = nextClass(rows)

  let empty = 'No published schedule for your section yet.'
  if (!student) empty = 'Your account is not linked to a student record. Sign out and sign in again, or contact the registrar.'
  else if (!student.section_id) empty = 'Your record has no section yet. Contact the registrar.'

  const details = student
    ? [
        `Student no. ${student.student_number}`,
        [student.course, student.year_level ? `Year ${student.year_level}` : '']
          .filter(Boolean)
          .join(' '),
        student.section?.section_name,
      ].filter(Boolean)
    : []

  return (
    <View style={{ gap: mobile ? 16 : 24 }}>
      <View style={{ gap: 6 }}>
        <H1>My Schedule</H1>
        {student && (
          <Text style={[FONT, { fontSize: 16, fontWeight: '600', color: C.ink }]}>
            {student.full_name}
          </Text>
        )}
        <Muted>{details.join(' · ')}</Muted>
      </View>
      <Banner>{r.error}</Banner>

      {terms.length > 1 && (
        <Select
          label="Term"
          value={term}
          onChange={setPickedTerm}
          options={terms}
          style={{ flexGrow: 0, flexBasis: 260, maxWidth: 320 }}
        />
      )}

      {r.loading ? (
        <Muted>Loading…</Muted>
      ) : rows.length === 0 ? (
        <Card>
          <Muted>{empty}</Muted>
        </Card>
      ) : (
        <>
          <Card>
            <H2>Next class</H2>
            {next && (
              <>
                <Text style={[FONT, { fontSize: 16, fontWeight: '600', color: C.ink }]}>
                  {next.subject?.code} {next.subject?.name}
                </Text>
                <Muted style={{ marginTop: 6, marginBottom: 14 }}>
                  {DAYS[next.day_of_week - 1]} · {hm(next.start_time)}–{hm(next.end_time)} ·{' '}
                  {next.room?.name}
                </Muted>
                <Btn
                  title="View in timetable"
                  onPress={() => {
                    setHighlight(next.id)
                    setDay(next.day_of_week)
                  }}
                  style={{ alignSelf: 'flex-start' }}
                />
              </>
            )}
          </Card>

          <Card>
            <H2>Weekly timetable</H2>
            <Timetable schedules={rows} day={day} onDay={setDay} highlightId={highlight} />
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ padding: 20, paddingBottom: 8 }}>
              <H2>Classes by day</H2>
            </View>
            {rows.map((s) => (
              <View
                key={s.id}
                style={{
                  flexDirection: mobile ? 'column' : 'row',
                  gap: mobile ? 2 : 16,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: C.border,
                }}
              >
                <Text style={[FONT, { width: mobile ? undefined : 150, fontSize: 14, fontWeight: '600', color: C.ink }]}>
                  {DAYS[s.day_of_week - 1]} {hm(s.start_time)}–{hm(s.end_time)}
                </Text>
                <Text style={[FONT, { flex: 1, fontSize: 14, color: C.ink }]}>
                  {s.subject?.code} {s.subject?.name}
                </Text>
                <Text style={[FONT, { flex: 1, fontSize: 14, color: C.muted }]}>
                  {[s.room?.name, s.instructor?.name].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
          </Card>

          {Platform.OS === 'web' && (
            <Btn
              title="Download PDF"
              onPress={() => window.print()}
              style={{ alignSelf: mobile ? 'stretch' : 'flex-start' }}
            />
          )}
        </>
      )}
    </View>
  )
}
