import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import Timetable from '../components/Timetable';
import { Banner, Btn, Card, Field, H1, H2, Muted, Select } from '../components/ui';
import { C, DAYS, FONT } from '../theme';

const hm = (t) => String(t).slice(0, 5);
const toMin = (t) => parseInt(t, 10) * 60 + parseInt(String(t).slice(3, 5), 10);
const hours = (s) => (toMin(s.end_time) - toMin(s.start_time)) / 60;
const WEEK = 7 * 1440;

// The class that starts soonest from now, wrapping around the week (Mon = 0).
function nextClass(rows) {
  const now = new Date();
  const nowMin = ((now.getDay() + 6) % 7) * 1440 + now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const s of rows) {
    let diff = (s.day_of_week - 1) * 1440 + toMin(s.start_time) - nowMin;
    if (diff < 0) diff += WEEK;
    if (!best || diff < best.diff) best = { s, diff };
  }
  return best?.s;
}

const printPage = () => { if (Platform.OS === 'web') window.print(); };

// Weekly timetable for Instructors (`mine`) and Viewers. Read-only.
export default function TimetableScreen({ title, mine }) {
  const r = useResource('/api/schedules', { sort: 'day_of_week', query: mine ? 'mine=true' : '' });
  const { profile } = useAuth();
  const mobile = useIsMobile();
  const [section, setSection] = useState('');
  const [semester, setSemester] = useState('');

  const semesters = useMemo(() => [...new Set(r.data.map((s) => s.semester))], [r.data]);
  const rows = useMemo(() => r.data.filter((s) =>
    (!semester || s.semester === semester) &&
    (!section.trim() || s.section.toLowerCase().includes(section.trim().toLowerCase()))), [r.data, semester, section]);

  const load = rows.reduce((sum, s) => sum + hours(s), 0);
  const max = profile?.instructor?.max_load_hours;
  const next = mine ? nextClass(rows) : null;
  const weekAgo = Date.now() - 7 * 86400000;
  const changed = mine ? rows.filter((s) => new Date(s.updated_at).getTime() > weekAgo) : [];

  const timetable = (
    <Card style={{ flexGrow: 2, flexBasis: 460, minWidth: 0 }}>
      <H2>Weekly timetable</H2>
      {r.loading ? <Muted>Loading…</Muted> : rows.length === 0
        ? <Muted>{mine ? 'No classes are assigned to you yet.' : 'No published schedules yet.'}</Muted>
        : <Timetable schedules={rows} />}
    </Card>
  );

  if (!mine) {
    return (
      <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ gap: 6 }}>
            <H1>{title}</H1>
            <Muted>Published schedules only. Read-only.</Muted>
          </View>
          <Btn title="Export PDF" onPress={printPage} />
        </View>
        <Banner>{r.error}</Banner>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Select label="Semester" value={semester} onChange={setSemester} options={[{ value: '', label: 'All semesters' }, ...semesters]} />
          <Field label="Section" value={section} onChangeText={setSection} placeholder="Filter by section" />
        </Card>
        {timetable}
      </View>
    );
  }

  const nextCard = (
    <Card>
      <H2>Next class</H2>
      {next ? (
        <>
          <Text style={[FONT, { fontSize: 16, fontWeight: '600', color: C.ink }]}>{next.subject?.code} {next.subject?.name}</Text>
          <Muted style={{ marginTop: 4 }}>{next.room?.name} · {DAYS[next.day_of_week - 1]} · {hm(next.start_time)}–{hm(next.end_time)}</Muted>
        </>
      ) : <Muted>No classes are assigned to you yet.</Muted>}
    </Card>
  );
  const loadCard = (
    <Card>
      <H2>Teaching load</H2>
      <Text style={[FONT, { fontSize: 24, fontWeight: '700', color: C.ink }]}>{load}{max ? ` / ${max}` : ''} hrs</Text>
      {!!max && (
        <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginTop: 10 }}>
          <View style={{ height: 8, width: `${Math.min(100, (load / max) * 100)}%`, backgroundColor: load > max ? C.danger : C.blue, borderRadius: 4 }} />
        </View>
      )}
    </Card>
  );
  const changesCard = (
    <Card>
      <H2>Schedule changes</H2>
      {changed.length === 0
        ? <Muted>No recent changes to your classes.</Muted>
        : changed.map((s) => (
            <Muted key={s.id}>{s.subject?.code} · {DAYS[s.day_of_week - 1]} {hm(s.start_time)}–{hm(s.end_time)} was updated this week.</Muted>
          ))}
    </Card>
  );
  const download = <Btn title="Download PDF" onPress={printPage} />;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <H1>{title}</H1>
        <Muted>Your classes for the published schedule.</Muted>
      </View>
      <Banner>{r.error}</Banner>
      {mobile ? (
        <View style={{ gap: 16 }}>{nextCard}{loadCard}{timetable}{changesCard}{download}</View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {timetable}
          <View style={{ flexGrow: 1, flexBasis: 260, gap: 24, minWidth: 0 }}>
            {loadCard}{changesCard}{nextCard}
            <View style={{ alignSelf: 'flex-start' }}>{download}</View>
          </View>
        </View>
      )}
    </View>
  );
}
