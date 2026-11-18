import React, { useMemo, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { useResource } from '../hooks/useResource'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import Timetable from '../components/Timetable'
import { Banner, Btn, Card, H1, H2, Muted, Select } from '../components/ui'
import { C, DAYS, DAY_OPTIONS, FONT } from '../theme'

const hm = (t) => String(t).slice(0, 5)
const toMin = (t) => parseInt(t, 10) * 60 + parseInt(String(t).slice(3, 5), 10)
const hours = (s) => (toMin(s.end_time) - toMin(s.start_time)) / 60
const WEEK = 7 * 1440
const today = () => {
  const d = new Date().getDay()
  return d === 0 ? 1 : d
}

// The class that starts soonest from now, wrapping around the week (Mon = 0).
function nextClass(rows) {
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

const printPage = () => {
  if (Platform.OS === 'web') window.print()
}

// Weekly timetable for Instructors (`mine`) and Viewers. Read-only.
export default function TimetableScreen({ title, mine }) {
  const r = useResource('/api/schedules', {
    sort: 'day_of_week',
    query: mine ? 'mine=true' : '',
  })
  const { profile } = useAuth()
  const mobile = useIsMobile()
  const [f, setF] = useState({
    semester: '',
    section: '',
    instructor: '',
    day: '',
  })
  const [day, setDay] = useState(today())
  const [highlight, setHighlight] = useState(null)

  const uniq = (fn) => [...new Set(r.data.map(fn))].filter(Boolean).sort()
  const withAll = (label, list) => [{ value: '', label }, ...list]
  const rows = useMemo(
    () =>
      mine
        ? r.data
        : r.data.filter(
            (s) =>
              (!f.semester || s.semester === f.semester) &&
              (!f.section || s.section === f.section) &&
              (!f.instructor || s.instructor?.name === f.instructor) &&
              (!f.day || String(s.day_of_week) === f.day),
          ),
    [r.data, f, mine],
  )

  const load = rows.reduce((sum, s) => sum + hours(s), 0)
  const max = profile?.instructor?.max_load_hours
  const next = mine ? nextClass(rows) : null
  const weekAgo = Date.now() - 7 * 86400000
  const changed = mine
    ? rows.filter((s) => new Date(s.updated_at).getTime() > weekAgo)
    : []
  const showNext = () => {
    if (next) {
      setHighlight(next.id)
      setDay(next.day_of_week)
    }
  }

  const timetable = (
    <Card style={{ flexGrow: 2, flexBasis: 460, minWidth: 0 }}>
      <H2>Weekly timetable</H2>
      {r.loading ? (
        <Muted>Loading…</Muted>
      ) : rows.length === 0 ? (
        <Muted>
          {mine
            ? 'No classes are assigned to you yet.'
            : 'No published schedules yet.'}
        </Muted>
      ) : (
        <Timetable
          schedules={rows}
          day={day}
          onDay={setDay}
          highlightId={highlight}
        />
      )}
    </Card>
  )

  if (!mine) {
    const exportBtn = <Btn title="Export PDF" onPress={printPage} />
    return (
      <View style={{ gap: mobile ? 16 : 24 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <View style={{ gap: 6 }}>
            <H1>{title}</H1>
            <Muted>Published schedules only. Read-only.</Muted>
          </View>
          {!mobile && exportBtn}
        </View>
        <Banner>{r.error}</Banner>
        <Card
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: mobile ? 12 : 14,
            padding: mobile ? 14 : 20,
          }}
        >
          <Select
            label="Semester"
            value={f.semester}
            onChange={(v) => setF({ ...f, semester: v })}
            options={withAll(
              'All semesters',
              uniq((s) => s.semester),
            )}
            style={{ flexBasis: mobile ? 130 : 150 }}
          />
          <Select
            label="Section"
            value={f.section}
            onChange={(v) => setF({ ...f, section: v })}
            options={withAll(
              'All sections',
              uniq((s) => s.section),
            )}
            style={{ flexBasis: mobile ? 130 : 150 }}
          />
          {!mobile && (
            <Select
              label="Instructor"
              value={f.instructor}
              onChange={(v) => setF({ ...f, instructor: v })}
              options={withAll(
                'All instructors',
                uniq((s) => s.instructor?.name),
              )}
            />
          )}
          {!mobile && (
            <Select
              label="Day"
              value={f.day}
              onChange={(v) => setF({ ...f, day: v })}
              options={withAll('All days', DAY_OPTIONS)}
            />
          )}
        </Card>
        {timetable}
        {mobile && exportBtn}
      </View>
    )
  }

  const nextCard = (
    <Card>
      <H2>Next class</H2>
      {next ? (
        <>
          <Text
            style={[FONT, { fontSize: 16, fontWeight: '600', color: C.ink }]}
          >
            {next.subject?.code} {next.subject?.name}
          </Text>
          <Muted style={{ marginTop: 6, marginBottom: 14 }}>
            {next.room?.name} · {DAYS[next.day_of_week - 1]} ·{' '}
            {hm(next.start_time)}–{hm(next.end_time)}
          </Muted>
          <Btn
            title="View in timetable"
            onPress={showNext}
            style={{ alignSelf: 'flex-start' }}
          />
        </>
      ) : (
        <Muted>No classes are assigned to you yet.</Muted>
      )}
    </Card>
  )
  const loadCard = (
    <Card>
      <H2>Teaching load</H2>
      <Text
        style={[
          FONT,
          { fontSize: mobile ? 22 : 28, fontWeight: '700', color: C.ink },
        ]}
      >
        {load}
        {max ? ` / ${max}` : ''} hrs
      </Text>
      {!!max && (
        <View
          style={{
            height: 8,
            backgroundColor: C.border,
            borderRadius: 4,
            marginTop: 10,
          }}
        >
          <View
            style={{
              height: 8,
              width: `${Math.min(100, (load / max) * 100)}%`,
              backgroundColor: load > max ? C.danger : C.blue,
              borderRadius: 4,
            }}
          />
        </View>
      )}
    </Card>
  )
  const changesCard = (
    <Card>
      <H2>Schedule changes</H2>
      {changed.length === 0 ? (
        <Muted>No recent changes to your classes.</Muted>
      ) : (
        changed.map((s) => (
          <Muted key={s.id}>
            {s.subject?.code} · {DAYS[s.day_of_week - 1]} {hm(s.start_time)}–
            {hm(s.end_time)} was updated this week.
          </Muted>
        ))
      )}
    </Card>
  )
  const download = (
    <Btn
      big={!mobile}
      title="Download PDF"
      onPress={printPage}
      style={{ alignSelf: mobile ? 'stretch' : 'flex-start' }}
    />
  )

  return (
    <View style={{ gap: mobile ? 16 : 24 }}>
      <View style={{ gap: 6 }}>
        <H1>{title}</H1>
        <Muted>
          {r.data[0]
            ? `${r.data[0].semester} · ${r.data[0].academic_year}`
            : 'Your classes for the published schedule.'}
        </Muted>
      </View>
      <Banner>{r.error}</Banner>
      {mobile ? (
        <View style={{ gap: 16 }}>
          {nextCard}
          {loadCard}
          {timetable}
          {changesCard}
          {download}
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          {timetable}
          <View style={{ flexGrow: 1, flexBasis: 260, gap: 24, minWidth: 0 }}>
            {loadCard}
            {changesCard}
            {nextCard}
            {download}
          </View>
        </View>
      )}
    </View>
  )
}
