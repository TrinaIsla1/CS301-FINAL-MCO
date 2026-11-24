import React, { useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View, Platform } from 'react-native'
import { api } from '../lib/api'
import { useResource } from '../hooks/useResource'
import { useIsMobile } from '../hooks/useIsMobile'
import Timetable from '../components/Timetable'
import ImportPanel from '../components/ImportPanel'
import {
  Banner,
  Btn,
  Card,
  H1,
  H2,
  Muted,
  Select,
  confirmAction,
} from '../components/ui'
import { C, DAYS, DAY_OPTIONS, FONT } from '../theme'
import { formatTimeRange12 } from '../utils/time'

const VIEW_BY = [
  { value: 'all', label: 'All rooms' },
  { value: 'instructor', label: 'By instructor' },
  { value: 'section', label: 'By section' },
]

export default function DashboardScreen({ go }) {
  const mobile = useIsMobile()
  const [stats, setStats] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [viewBy, setViewBy] = useState('all')
  const [viewValue, setViewValue] = useState('')
  const [tf, setTf] = useState({
    semester: '',
    day: '',
    instructor: '',
    room: '',
  })
  const r = useResource('/api/schedules', { sort: 'day_of_week' })

  const loadStats = () =>
    Promise.all([api.get('/api/stats'), api.get('/api/alerts')])
      .then(([s, a]) => {
        setStats(s.data)
        setAlerts(a.data)
      })
      .catch((e) => setError(e.message))
  useEffect(() => {
    loadStats()
  }, [r.data.length])

  const first = r.data[0]
  const subtitle = first
    ? `${first.semester} · ${first.academic_year}`
    : 'No schedules yet'
  const cards = [
    ['Subjects', 'subjects'],
    ['Instructors', 'instructors'],
    ['Rooms', 'rooms'],
    ['Class schedules', 'schedules'],
  ]

  const uniq = (fn) => [...new Set(r.data.map(fn))].filter(Boolean).sort()
  const opt = (label, list) => [{ value: '', label }, ...list]

  // "View by" narrows the weekly timetable to one instructor or one section.
  const viewRows = useMemo(() => {
    if (viewBy === 'instructor' && viewValue)
      return r.data.filter((s) => s.instructor?.name === viewValue)
    if (viewBy === 'section' && viewValue)
      return r.data.filter((s) => s.section === viewValue)
    return r.data
  }, [r.data, viewBy, viewValue])

  // Filters above the class schedules table.
  const tableRows = useMemo(
    () =>
      r.data.filter(
        (s) =>
          (!tf.semester || s.semester === tf.semester) &&
          (!tf.day || String(s.day_of_week) === tf.day) &&
          (!tf.instructor || s.instructor?.name === tf.instructor) &&
          (!tf.room || s.room?.name === tf.room),
      ),
    [r.data, tf],
  )

  const remove = async (s) => {
    if (!confirmAction('Delete this class schedule? This cannot be undone.'))
      return
    try {
      await r.remove(s.id)
    } catch (e) {
      setError(e.message)
    }
  }

  const statCards = (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: mobile ? 12 : 16 }}
    >
      {cards.map(([label, key]) => (
        <Card
          key={key}
          style={{
            flexGrow: 1,
            flexBasis: mobile ? 140 : 200,
            padding: mobile ? 14 : 20,
          }}
        >
          <Muted style={{ fontSize: 13 }}>{label}</Muted>
          <Text
            style={[
              FONT,
              {
                fontSize: mobile ? 26 : 32,
                fontWeight: '700',
                color: C.ink,
                marginTop: 6,
              },
            ]}
          >
            {stats ? stats[key] : '—'}
          </Text>
        </Card>
      ))}
    </View>
  )

  const timetable = (
    <Card style={{ flexGrow: 2, flexBasis: 560, minWidth: 0 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Text
          accessibilityRole="header"
          style={[FONT, { fontSize: 17, fontWeight: '600', color: C.ink }]}
        >
          {mobile ? 'Classes' : 'Weekly timetable'}
        </Text>
        {!mobile && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Select
              compact
              label="View by"
              value={viewBy}
              onChange={(v) => {
                setViewBy(v)
                setViewValue('')
              }}
              options={VIEW_BY}
            />
            {viewBy === 'instructor' && (
              <Select
                compact
                label="Instructor"
                value={viewValue}
                onChange={setViewValue}
                options={opt(
                  'All instructors',
                  uniq((s) => s.instructor?.name),
                )}
              />
            )}
            {viewBy === 'section' && (
              <Select
                compact
                label="Section"
                value={viewValue}
                onChange={setViewValue}
                options={opt(
                  'All sections',
                  uniq((s) => s.section),
                )}
              />
            )}
          </View>
        )}
      </View>
      {r.loading ? (
        <Muted>Loading…</Muted>
      ) : viewRows.length === 0 ? (
        <Muted>
          {r.data.length
            ? 'No classes match this view.'
            : 'No schedules yet. Use “Add schedule” to create the first class.'}
        </Muted>
      ) : (
        <Timetable schedules={viewRows} formatTimes spanDuration />
      )}
    </Card>
  )

  const alertsCard = (
    <Card>
      <H2>Conflict alerts</H2>
      {alerts.length === 0 ? (
        <Muted>No room, instructor, or section conflicts detected.</Muted>
      ) : (
        alerts.map((a, i) => (
          <Text
            key={i}
            style={[FONT, { fontSize: 14, color: C.danger, marginBottom: 4 }]}
          >
            • {a.message}
          </Text>
        ))
      )}
    </Card>
  )

  if (mobile) {
    return (
      <View style={{ gap: 16 }}>
        <View>
          <H1>Dashboard</H1>
          <Muted style={{ fontSize: 13, marginTop: 4 }}>{subtitle}</Muted>
        </View>
        <Banner>{error || r.error}</Banner>
        {statCards}
        {timetable}
        {alertsCard}
      </View>
    )
  }

  const cols = [
    { label: 'Subject', w: 2.2 },
    { label: 'Instructor', w: 1.5 },
    { label: 'Room', w: 1 },
    { label: 'Day / Time', w: 1.4 },
    { label: 'Status', w: 0.8 },
  ]
  const roomNames = uniq((s) => s.room?.name)

  return (
    <View style={{ gap: 24 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <View>
          <H1>Dashboard</H1>
          <Muted style={{ marginTop: 6 }}>{subtitle}</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn title="Import CSV" onPress={() => setImporting((v) => !v)} />
          {Platform.OS === 'web' && (
            <Btn title="Export PDF" onPress={() => window.print()} />
          )}
        </View>
      </View>
      <Banner>{error || r.error}</Banner>
      {importing && (
        <ImportPanel onClose={() => setImporting(false)} onDone={loadStats} />
      )}
      {statCards}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {timetable}
        <View style={{ flexGrow: 1, flexBasis: 280, gap: 24, minWidth: 0 }}>
          {alertsCard}
          <Card style={{ gap: 10 }}>
            <H2>Quick actions</H2>
            <Btn
              title="+ Add subject"
              onPress={() => go('Subjects', { add: true })}
            />
            <Btn
              title="+ Add instructor"
              onPress={() => go('Instructors', { add: true })}
            />
            <Btn
              title="+ Add room"
              onPress={() => go('Rooms', { add: true })}
            />
          </Card>
        </View>
      </View>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            padding: 20,
          }}
        >
          <Text
            accessibilityRole="header"
            style={[FONT, { fontSize: 17, fontWeight: '600', color: C.ink }]}
          >
            Class schedules
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Select
              compact
              label="Semester"
              value={tf.semester}
              onChange={(v) => setTf({ ...tf, semester: v })}
              options={opt(
                'Semester',
                uniq((s) => s.semester),
              )}
            />
            <Select
              compact
              label="Day"
              value={tf.day}
              onChange={(v) => setTf({ ...tf, day: v })}
              options={opt('Day', DAY_OPTIONS)}
            />
            <Select
              compact
              label="Instructor"
              value={tf.instructor}
              onChange={(v) => setTf({ ...tf, instructor: v })}
              options={opt(
                'Instructor',
                uniq((s) => s.instructor?.name),
              )}
            />
            <Select
              compact
              label="Room"
              value={tf.room}
              onChange={(v) => setTf({ ...tf, room: v })}
              options={opt('Room', roomNames)}
            />
          </View>
        </View>
        <ScrollView horizontal>
          <View style={{ minWidth: 760, flex: 1 }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head }}>
              {cols.map((c) => (
                <Text
                  key={c.label}
                  style={[
                    FONT,
                    {
                      flex: c.w,
                      padding: 14,
                      fontSize: 13,
                      fontWeight: '600',
                      color: C.ink,
                    },
                  ]}
                >
                  {c.label}
                </Text>
              ))}
              <View style={{ width: 170, padding: 14 }}>
                <Text style={[FONT, { fontSize: 13, fontWeight: '600' }]}>
                  Actions
                </Text>
              </View>
            </View>
            {tableRows.length === 0 && (
              <Muted style={{ padding: 16 }}>
                {r.data.length
                  ? 'No classes match these filters.'
                  : 'No schedules yet.'}
              </Muted>
            )}
            {tableRows.map((s) => {
              const cells = [
                `${s.subject?.code ?? ''} ${s.subject?.name ?? ''} · ${s.section}`,
                s.instructor?.name,
                s.room?.name,
                `${DAYS[s.day_of_week - 1]} ${formatTimeRange12(s.start_time, s.end_time)}`,
                s.status[0].toUpperCase() + s.status.slice(1),
              ]
              return (
                <View
                  key={s.id}
                  style={{
                    flexDirection: 'row',
                    borderTopWidth: 1,
                    borderTopColor: C.border,
                    alignItems: 'center',
                  }}
                >
                  {cells.map((v, i) => (
                    <Text
                      key={i}
                      style={[
                        FONT,
                        {
                          flex: cols[i].w,
                          padding: 14,
                          fontSize: 14,
                          color: C.ink,
                        },
                      ]}
                    >
                      {v}
                    </Text>
                  ))}
                  <View
                    style={{
                      width: 90,
                      padding: 8,
                      flexDirection: 'row',
                      gap: 8,
                    }}
                  >
                    <Btn
                      small
                      kind="danger"
                      title="Delete"
                      onPress={() => remove(s)}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        </ScrollView>
      </Card>
    </View>
  )
}
