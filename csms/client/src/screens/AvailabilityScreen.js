import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Banner, Btn, Card, H1, H2, Muted, Select } from '../components/ui';
import { C, DAYS, DAY_OPTIONS, FONT } from '../theme';

const TIMES = Array.from({ length: 28 }, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const hm = (t) => String(t).slice(0, 5);

// Instructor: the weekly times they can teach. The Admin's schedule builder respects these.
export default function AvailabilityScreen() {
  const { profile } = useAuth();
  const linked = !!profile?.instructor?.id;
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ day_of_week: '1', start_time: '08:00', end_time: '12:00' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    if (!linked) return;
    api.get('/api/availability').then((r) => setRows(r.data)).catch((e) => setError(e.message));
  }, [linked]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setError(''); setMessage('');
    if (form.end_time <= form.start_time) return setError('End time must be later than start time.');
    try {
      await api.post('/api/availability', { ...form, day_of_week: Number(form.day_of_week) });
      setMessage('Time added.'); load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    try { await api.del(`/api/availability/${id}`); setMessage('Time removed.'); setError(''); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <H1>My Availability</H1>
        <Muted>Add the times you can teach. Classes can only be scheduled inside these times. With nothing added, you count as available any time.</Muted>
      </View>
      {!linked && <Banner>Your login is not linked to an instructor record yet. Ask the Admin to link it.</Banner>}
      <Banner>{error}</Banner>
      <Banner kind="ok">{message}</Banner>

      {linked && (
        <Card>
          <H2>Add a time</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Select label="Day" value={form.day_of_week} onChange={(v) => setForm({ ...form, day_of_week: v })} options={DAY_OPTIONS} />
            <Select label="From" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} options={TIMES} />
            <Select label="To" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} options={TIMES} />
          </View>
          <View style={{ marginTop: 16, alignSelf: 'flex-start' }}><Btn kind="primary" title="Add time" onPress={add} /></View>
        </Card>
      )}

      <Card>
        <H2>My weekly availability</H2>
        {rows.length === 0 && <Muted>No times added yet.</Muted>}
        {DAYS.map((d, i) => {
          const day = rows.filter((r) => r.day_of_week === i + 1);
          if (!day.length) return null;
          return (
            <View key={d} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={[FONT, { width: 60, fontSize: 14, fontWeight: '600', color: C.ink }]}>{d}</Text>
              {day.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.blueSoft, borderRadius: 8, paddingLeft: 12 }}>
                  <Text style={[FONT, { fontSize: 14, color: '#1B3FB0' }]}>{hm(r.start_time)}–{hm(r.end_time)}</Text>
                  <Btn small title="Remove" onPress={() => remove(r.id)} />
                </View>
              ))}
            </View>
          );
        })}
      </Card>
    </View>
  );
}
