import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { Banner, Btn, Card, Field, H1, H2, Muted, Select, confirmAction } from '../components/ui';
import { C, DAYS, DAY_OPTIONS, FONT } from '../theme';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const blank = {
  subject_id: '', instructor_id: '', room_id: '', section: '', semester: '1st Semester',
  academic_year: '', day_of_week: '1', start_time: '08:00', end_time: '09:30', status: 'draft',
};
const hm = (t) => String(t).slice(0, 5);

// Admin only: build, check, publish and manage class schedules.
export default function SchedulesScreen() {
  const r = useResource('/api/schedules', { sort: 'day_of_week' });
  const [lists, setLists] = useState({ subjects: [], instructors: [], rooms: [] });
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all(['subjects', 'instructors', 'rooms'].map((n) => api.get(`/api/${n}?pageSize=200`)))
      .then(([s, i, rm]) => setLists({ subjects: s.data, instructors: i.data, rooms: rm.data }))
      .catch((e) => setError(e.message));
  }, []);

  const opts = (rows, label) => [{ value: '', label: 'Select…' }, ...rows.map((x) => ({ value: x.id, label: label(x) }))];
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setConflicts([]); };

  const payload = () => ({ ...form, day_of_week: Number(form.day_of_week) });

  const validate = () => {
    if (!form.subject_id || !form.instructor_id || !form.room_id) return 'Choose a subject, instructor and room.';
    if (!form.section.trim() || !form.academic_year.trim()) return 'Enter the section and academic year.';
    if (!TIME.test(form.start_time) || !TIME.test(form.end_time)) return 'Enter times as HH:MM, for example 08:00.';
    if (form.end_time <= form.start_time) return 'End time must be later than start time.';
    return '';
  };

  const check = async () => {
    const v = validate(); if (v) return setError(v);
    setError(''); setMessage('');
    try {
      const { conflicts: c } = await api.post('/api/schedules/check-conflict', { ...payload(), id: editingId });
      setConflicts(c);
      if (!c.length) setMessage('No conflicts. This schedule is ready to save.');
    } catch (e) { setError(e.message); }
  };

  const save = async (status) => {
    const v = validate(); if (v) return setError(v);
    setError(''); setMessage('');
    try {
      const body = { ...payload(), status };
      if (editingId) await r.update(editingId, body); else await r.create(body);
      setMessage(status === 'published' ? 'Schedule published.' : 'Draft saved.');
      setForm(blank); setEditingId(null); setConflicts([]);
    } catch (e) {
      setError(e.message);
      if (e.details?.conflicts) setConflicts(e.details.conflicts);
    }
  };

  const edit = (s) => {
    setEditingId(s.id);
    setForm({ ...s, day_of_week: String(s.day_of_week), start_time: hm(s.start_time), end_time: hm(s.end_time) });
    setConflicts([]); setError(''); setMessage('');
  };

  const remove = async (s) => {
    if (!confirmAction('Delete this class schedule? This cannot be undone.')) return;
    try { await r.remove(s.id); setMessage('Schedule deleted.'); } catch (e) { setError(e.message); }
  };

  const cols = [
    { label: 'Subject', w: 2 }, { label: 'Instructor', w: 1.5 }, { label: 'Room', w: 1 },
    { label: 'Day', sort: 'day_of_week', w: 0.7 }, { label: 'Time', sort: 'start_time', w: 1 },
    { label: 'Section', sort: 'section', w: 0.8 }, { label: 'Status', sort: 'status', w: 0.8 },
  ];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <H1>Schedules</H1>
        <Muted>Build and publish class schedules. Conflicts are checked before saving.</Muted>
      </View>

      <Card>
        <H2>{editingId ? 'Edit class schedule' : 'New class schedule'}</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Select label="Subject" value={form.subject_id} onChange={set('subject_id')} options={opts(lists.subjects, (s) => `${s.code} ${s.name}`)} />
          <Select label="Instructor" value={form.instructor_id} onChange={set('instructor_id')} options={opts(lists.instructors, (i) => i.name)} />
          <Select label="Room" value={form.room_id} onChange={set('room_id')} options={opts(lists.rooms, (x) => `${x.building ? x.building + ' ' : ''}${x.name}`)} />
          <Select label="Day" value={form.day_of_week} onChange={set('day_of_week')} options={DAY_OPTIONS} />
          <Field label="Start (HH:MM)" value={form.start_time} onChangeText={set('start_time')} />
          <Field label="End (HH:MM)" value={form.end_time} onChangeText={set('end_time')} />
          <Field label="Section" value={form.section} onChangeText={set('section')} />
          <Select label="Semester" value={form.semester} onChange={set('semester')} options={['1st Semester', '2nd Semester', 'Summer']} />
          <Field label="Academic year" value={form.academic_year} onChangeText={set('academic_year')} placeholder="e.g. 2026-2027" />
        </View>
        <View style={{ gap: 10, marginTop: 16 }}>
          <Banner>{error}</Banner>
          <Banner kind="ok">{message}</Banner>
          {conflicts.length > 0 && (
            <View style={{ backgroundColor: C.dangerBg, borderRadius: 8, padding: 12, gap: 4 }}>
              <Text style={[FONT, { fontWeight: '600', color: C.danger }]}>Fix these conflicts before saving:</Text>
              {conflicts.map((c, i) => <Text key={i} style={[FONT, { fontSize: 14, color: C.danger }]}>• {c.message}</Text>)}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Btn title="Check conflicts" onPress={check} />
            <Btn title="Save as draft" onPress={() => save('draft')} />
            <Btn kind="primary" title="Save and publish" onPress={() => save('published')} />
            {editingId && <Btn title="Cancel edit" onPress={() => { setEditingId(null); setForm(blank); setConflicts([]); }} />}
          </View>
        </View>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 860, flex: 1 }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head }}>
              {cols.map((c) => (
                <Pressable key={c.label} disabled={!c.sort} onPress={() => r.toggleSort(c.sort)} style={{ flex: c.w, padding: 14 }} accessibilityRole={c.sort ? 'button' : 'text'}>
                  <Text style={[FONT, { fontSize: 13, fontWeight: '600', color: C.ink }]}>
                    {c.label}{c.sort ? (r.sortBy.sort === c.sort ? (r.sortBy.order === 'asc' ? ' ▲' : ' ▼') : ' ↕') : ''}
                  </Text>
                </Pressable>
              ))}
              <View style={{ width: 170, padding: 14 }}><Text style={[FONT, { fontSize: 13, fontWeight: '600' }]}>Actions</Text></View>
            </View>
            {r.loading && <Muted style={{ padding: 16 }}>Loading…</Muted>}
            {!r.loading && r.data.length === 0 && <Muted style={{ padding: 16 }}>No schedules yet. Fill in the form above to add the first class.</Muted>}
            {r.data.map((s) => {
              const cells = [
                `${s.subject?.code ?? ''} ${s.subject?.name ?? ''}`, s.instructor?.name, s.room?.name,
                DAYS[s.day_of_week - 1], `${hm(s.start_time)}–${hm(s.end_time)}`, s.section, s.status,
              ];
              return (
                <View key={s.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' }}>
                  {cells.map((v, i) => <Text key={i} style={[FONT, { flex: cols[i].w, padding: 14, fontSize: 14, color: C.ink }]}>{v}</Text>)}
                  <View style={{ width: 170, padding: 8, flexDirection: 'row', gap: 8 }}>
                    <Btn small title="Edit" onPress={() => edit(s)} />
                    <Btn small kind="danger" title="Delete" onPress={() => remove(s)} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
}
