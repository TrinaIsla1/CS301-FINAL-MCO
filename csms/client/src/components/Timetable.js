import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { C, DAYS, FONT } from '../theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { formatTime12, formatTimeRange12 } from '../utils/time'

const PALETTE = [
  ['#E4EBFD', '#1B3FB0'],
  ['#DDF3E8', '#14633D'],
  ['#FDE8D8', '#8A3B0B'],
  ['#F1E4FB', '#5B2A86'],
]
const colorFor = (code = '') =>
  PALETTE[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]
const hm = (t) => String(t).slice(0, 5)
const hourLabel = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`
const HOUR_HEIGHT = 64
const HALF_HOUR_HEIGHT = HOUR_HEIGHT / 2
const toMinutes = (time) =>
  parseInt(time, 10) * 60 + parseInt(String(time).slice(3, 5), 10)

// Today as 1 (Mon) to 6 (Sat). Sunday shows Monday.
const todayIndex = () => {
  const d = new Date().getDay()
  return d === 0 ? 1 : d
}

// Phone view: Mon to Sat buttons, then that day's classes in time order.
function DayList({ schedules, day: dayProp, onDay, highlightId, formatTimes }) {
  const [own, setOwn] = useState(todayIndex())
  const day = dayProp ?? own
  const setDay = onDay || setOwn
  const rows = schedules
    .filter((s) => s.day_of_week === day)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {DAYS.map((d, i) => (
          <Pressable
            key={d}
            onPress={() => setDay(i + 1)}
            accessibilityRole="button"
            accessibilityState={{ selected: day === i + 1 }}
            style={{
              minWidth: 52,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: day === i + 1 ? C.blue : '#CBD2DC',
              backgroundColor: day === i + 1 ? C.blue : '#fff',
            }}
          >
            <Text
              style={[
                FONT,
                {
                  fontSize: 13,
                  fontWeight: '600',
                  color: day === i + 1 ? '#fff' : C.ink,
                },
              ]}
            >
              {d}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {rows.length === 0 && (
        <Text style={[FONT, { fontSize: 14, color: C.muted }]}>
          No classes on this day.
        </Text>
      )}
      {rows.map((s) => {
        const [bg, fg] = colorFor(s.subject?.code)
        return (
          <View
            key={s.id}
            style={{
              flexDirection: 'row',
              gap: 12,
              backgroundColor: bg,
              borderRadius: 12,
              padding: 12,
              borderWidth: 2,
              borderColor: s.id === highlightId ? C.ink : 'transparent',
            }}
          >
            <Text
              style={[
                FONT,
                { width: 96, fontSize: 13, fontWeight: '700', color: fg },
              ]}
            >
              {formatTimes
                ? formatTimeRange12(s.start_time, s.end_time)
                : `${hm(s.start_time)}–${hm(s.end_time)}`}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[FONT, { fontSize: 13, fontWeight: '600', color: fg }]}
              >
                {s.subject?.code} {s.subject?.name}
              </Text>
              <Text style={[FONT, { fontSize: 13, color: fg }]}>
                {s.room?.name}
                {s.instructor?.name ? ` · ${s.instructor.name}` : ''}
                {s.status === 'draft' ? ' (draft)' : ''}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

// Desktop view: weekly grid, Monday to Saturday. A class sits in the row of the hour it starts.
function Grid({ schedules, highlightId, formatTimes }) {
  const hours = useMemo(() => {
    const starts = schedules.map((s) => parseInt(s.start_time, 10))
    const first = Math.min(7, ...starts)
    const last = Math.max(17, ...starts)
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  }, [schedules])

  return (
    <ScrollView horizontal>
      <View style={{ minWidth: 720, flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ width: 70 }} />
          {DAYS.map((d) => (
            <Text
              key={d}
              style={[
                FONT,
                { flex: 1, fontSize: 12, fontWeight: '600', color: C.muted },
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
        {hours.map((h) => (
          <View
            key={h}
            style={{
              flexDirection: 'row',
              gap: 6,
              marginBottom: 6,
              minHeight: 36,
            }}
          >
            <Text style={[FONT, { width: 70, fontSize: 12, color: C.muted }]}>
              {hourLabel(h)}
            </Text>
            {DAYS.map((_, i) => (
              <View key={i} style={{ flex: 1, gap: 4 }}>
                {schedules
                  .filter(
                    (s) =>
                      s.day_of_week === i + 1 &&
                      parseInt(s.start_time, 10) === h,
                  )
                  .map((s) => {
                    const [bg, fg] = colorFor(s.subject?.code)
                    return (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: bg,
                          borderRadius: 8,
                          padding: 8,
                          borderWidth: 2,
                          borderColor:
                            s.id === highlightId ? C.ink : 'transparent',
                        }}
                      >
                        <Text
                          style={[
                            FONT,
                            { fontSize: 12, fontWeight: '600', color: fg },
                          ]}
                        >
                          {s.subject?.code}
                        </Text>
                        <Text style={[FONT, { fontSize: 12, color: fg }]}>
                          {s.room?.name}
                          {s.status === 'draft' ? ' (draft)' : ''}
                        </Text>
                        <Text style={[FONT, { fontSize: 11, color: fg }]}>
                          {formatTimes
                            ? formatTimeRange12(s.start_time, s.end_time)
                            : `${hm(s.start_time)}–${hm(s.end_time)}`}
                        </Text>
                      </View>
                    )
                  })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function laneSchedules(schedules) {
  const sorted = [...schedules].sort(
    (a, b) => toMinutes(a.start_time) - toMinutes(b.start_time),
  )
  const groups = []
  let group = []
  let groupEnd = -1

  for (const schedule of sorted) {
    const start = toMinutes(schedule.start_time)
    const end = toMinutes(schedule.end_time)
    if (group.length && start >= groupEnd) {
      groups.push(group)
      group = []
      groupEnd = -1
    }
    group.push(schedule)
    groupEnd = Math.max(groupEnd, end)
  }
  if (group.length) groups.push(group)

  return groups.flatMap((overlapping) => {
    const laneEnds = []
    const placed = overlapping.map((schedule) => {
      const start = toMinutes(schedule.start_time)
      const end = toMinutes(schedule.end_time)
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = end
      return { schedule, lane }
    })
    return placed.map((item) => ({
      ...item,
      laneCount: laneEnds.length,
    }))
  })
}

function DurationGrid({ schedules, highlightId }) {
  const { hours, slots, firstHour, height } = useMemo(() => {
    const starts = schedules.map((s) => toMinutes(s.start_time))
    const ends = schedules.map((s) => toMinutes(s.end_time))
    const first = Math.min(7 * 60, ...starts)
    const last = Math.max(17 * 60, ...ends)
    const firstHour = Math.floor(first / 60)
    const lastHour = Math.ceil(last / 60)
    const hours = Array.from(
      { length: lastHour - firstHour + 1 },
      (_, i) => firstHour + i,
    )
    const slots = Array.from(
      { length: hours.length * 2 },
      (_, i) => firstHour * 60 + i * 30,
    )
    return {
      hours,
      slots,
      firstHour,
      height: slots.length * HALF_HOUR_HEIGHT,
    }
  }, [schedules])

  return (
    <ScrollView horizontal>
      <View style={{ minWidth: 720, flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ width: 70 }} />
          {DAYS.map((day) => (
            <Text
              key={day}
              style={[
                FONT,
                { flex: 1, fontSize: 12, fontWeight: '600', color: C.muted },
              ]}
            >
              {day}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ width: 70 }}>
            {slots.map((time, index) => (
              <Text
                key={time}
                style={[
                  FONT,
                  {
                    height: HALF_HOUR_HEIGHT,
                    fontSize: 12,
                    color: C.muted,
                    transform: [
                      {
                        translateY:
                          index === 0 ? 0 : -HALF_HOUR_HEIGHT / 2,
                      },
                    ],
                  },
                ]}
              >
                {formatTime12(
                  `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`,
                )}
              </Text>
            ))}
          </View>
          {DAYS.map((day, index) => {
            const daySchedules = laneSchedules(
              schedules.filter((schedule) => schedule.day_of_week === index + 1),
            )
            return (
              <View
                key={day}
                style={{
                  flex: 1,
                  height,
                  position: 'relative',
                  borderLeftWidth: index === 0 ? 1 : 0,
                  borderRightWidth: 1,
                  borderColor: '#E1E6EF',
                }}
              >
                {Array.from({ length: hours.length * 2 + 1 }, (_, line) => {
                  const hourLine = line % 2 === 0
                  return (
                    <View
                      key={`grid-line-${line}`}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: line * HALF_HOUR_HEIGHT,
                        left: 0,
                        right: 0,
                        borderTopWidth: 1,
                        borderTopColor: hourLine ? '#C7D0DC' : '#D9E0E9',
                        borderStyle: 'solid',
                        zIndex: 2,
                      }}
                    />
                  )
                })}
                {daySchedules.map(({ schedule, lane, laneCount }) => {
                  const start = toMinutes(schedule.start_time)
                  const end = toMinutes(schedule.end_time)
                  const startSlot = (start - firstHour * 60) / 30
                  const endSlot = (end - firstHour * 60) / 30
                  const [bg, fg] = colorFor(schedule.subject?.code)
                  return (
                    <View
                      key={schedule.id}
                      style={{
                        position: 'absolute',
                        top: startSlot * HALF_HOUR_HEIGHT,
                        left: `${(lane / laneCount) * 100}%`,
                        width: `${100 / laneCount}%`,
                        height: (endSlot - startSlot) * HALF_HOUR_HEIGHT,
                        backgroundColor: bg,
                        zIndex: 1,
                        borderRadius: 8,
                        padding: 8,
                        borderWidth: 2,
                        borderColor:
                          schedule.id === highlightId ? C.ink : 'transparent',
                        borderBottomWidth: 1,
                        borderBottomColor: fg,
                      }}
                    >
                      <Text
                        style={[
                          FONT,
                          { fontSize: 12, fontWeight: '600', color: fg },
                        ]}
                      >
                        {schedule.subject?.code}
                      </Text>
                      <Text style={[FONT, { fontSize: 12, color: fg }]}>
                        {schedule.room?.name}
                        {schedule.status === 'draft' ? ' (draft)' : ''}
                      </Text>
                      <Text style={[FONT, { fontSize: 11, color: fg }]}>
                        {formatTimeRange12(schedule.start_time, schedule.end_time)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

// Same timetable for every role. Phones get the day-by-day list, larger screens the weekly grid.
export default function Timetable({
  schedules,
  day,
  onDay,
  highlightId,
  formatTimes = false,
  spanDuration = false,
}) {
  const mobile = useIsMobile()
  return mobile ? (
    <DayList
      schedules={schedules}
      day={day}
      onDay={onDay}
      highlightId={highlightId}
      formatTimes={formatTimes}
    />
  ) : (
    spanDuration ? (
      <DurationGrid schedules={schedules} highlightId={highlightId} />
    ) : (
      <Grid
        schedules={schedules}
        highlightId={highlightId}
        formatTimes={formatTimes}
      />
    )
  )
}
