import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { C, DAYS, FONT } from '../theme';
import { useIsMobile } from '../hooks/useIsMobile';

const PALETTE = [['#E4EBFD', '#1B3FB0'], ['#DDF3E8', '#14633D'], ['#FDE8D8', '#8A3B0B'], ['#F1E4FB', '#5B2A86']];
const colorFor = (code = '') => PALETTE[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
const hm = (t) => String(t).slice(0, 5);
const hourLabel = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;

// Today as 1 (Mon) to 6 (Sat). Sunday shows Monday.
const todayIndex = () => { const d = new Date().getDay(); return d === 0 ? 1 : d; };

// Phone view: Mon to Sat buttons, then that day's classes in time order.
function DayList({ schedules }) {
  const [day, setDay] = useState(todayIndex());
  const rows = schedules.filter((s) => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DAYS.map((d, i) => (
          <Pressable key={d} onPress={() => setDay(i + 1)} accessibilityRole="button" accessibilityState={{ selected: day === i + 1 }}
            style={{ minWidth: 52, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
              borderColor: day === i + 1 ? C.blue : '#CBD2DC', backgroundColor: day === i + 1 ? C.blue : '#fff' }}>
            <Text style={[FONT, { fontSize: 13, fontWeight: '600', color: day === i + 1 ? '#fff' : C.ink }]}>{d}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {rows.length === 0 && <Text style={[FONT, { fontSize: 14, color: C.muted }]}>No classes on this day.</Text>}
      {rows.map((s) => {
        const [bg, fg] = colorFor(s.subject?.code);
        return (
          <View key={s.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: bg, borderRadius: 12, padding: 12 }}>
            <Text style={[FONT, { width: 96, fontSize: 13, fontWeight: '700', color: fg }]}>{hm(s.start_time)}–{hm(s.end_time)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[FONT, { fontSize: 13, fontWeight: '600', color: fg }]}>{s.subject?.code} {s.subject?.name}</Text>
              <Text style={[FONT, { fontSize: 13, color: fg }]}>
                {s.room?.name}{s.instructor?.name ? ` · ${s.instructor.name}` : ''}{s.status === 'draft' ? ' (draft)' : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Desktop view: weekly grid, Monday to Saturday. A class sits in the row of the hour it starts.
function Grid({ schedules }) {
  const hours = useMemo(() => {
    const starts = schedules.map((s) => parseInt(s.start_time, 10));
    const first = Math.min(7, ...starts);
    const last = Math.max(17, ...starts);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [schedules]);

  return (
    <ScrollView horizontal>
      <View style={{ minWidth: 720, flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ width: 70 }} />
          {DAYS.map((d) => (
            <Text key={d} style={[FONT, { flex: 1, fontSize: 12, fontWeight: '600', color: C.muted }]}>{d}</Text>
          ))}
        </View>
        {hours.map((h) => (
          <View key={h} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, minHeight: 36 }}>
            <Text style={[FONT, { width: 70, fontSize: 12, color: C.muted }]}>{hourLabel(h)}</Text>
            {DAYS.map((_, i) => (
              <View key={i} style={{ flex: 1, gap: 4 }}>
                {schedules
                  .filter((s) => s.day_of_week === i + 1 && parseInt(s.start_time, 10) === h)
                  .map((s) => {
                    const [bg, fg] = colorFor(s.subject?.code);
                    return (
                      <View key={s.id} style={{ backgroundColor: bg, borderRadius: 8, padding: 8 }}>
                        <Text style={[FONT, { fontSize: 12, fontWeight: '600', color: fg }]}>{s.subject?.code}</Text>
                        <Text style={[FONT, { fontSize: 12, color: fg }]}>{s.room?.name}{s.status === 'draft' ? ' (draft)' : ''}</Text>
                        <Text style={[FONT, { fontSize: 11, color: fg }]}>{hm(s.start_time)}–{hm(s.end_time)}</Text>
                      </View>
                    );
                  })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Same timetable for every role. Phones get the day-by-day list, larger screens the weekly grid.
export default function Timetable({ schedules }) {
  const mobile = useIsMobile();
  return mobile ? <DayList schedules={schedules} /> : <Grid schedules={schedules} />;
}
