import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import Timetable from '../components/Timetable';
import { Banner, Card, H1, H2, Muted } from '../components/ui';
import { C, FONT } from '../theme';

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const r = useResource('/api/schedules', { sort: 'day_of_week' });

  useEffect(() => {
    Promise.all([api.get('/api/stats'), api.get('/api/alerts')])
      .then(([s, a]) => { setStats(s.data); setAlerts(a.data); })
      .catch((e) => setError(e.message));
  }, [r.data.length]);

  const cards = [['Subjects', 'subjects'], ['Instructors', 'instructors'], ['Rooms', 'rooms'], ['Class schedules', 'schedules']];

  return (
    <View style={{ gap: 20 }}>
      <H1>Dashboard</H1>
      <Banner>{error || r.error}</Banner>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {cards.map(([label, key]) => (
          <Card key={key} style={{ flexGrow: 1, flexBasis: 150 }}>
            <Muted>{label}</Muted>
            <Text style={[FONT, { fontSize: 28, fontWeight: '700', color: C.ink, marginTop: 6 }]}>{stats ? stats[key] : '—'}</Text>
          </Card>
        ))}
      </View>
      <Card>
        <H2>Conflict alerts</H2>
        {alerts.length === 0
          ? <Muted>No room, instructor, or section conflicts detected.</Muted>
          : alerts.map((a, i) => <Text key={i} style={[FONT, { fontSize: 14, color: C.danger, marginBottom: 4 }]}>• {a.message}</Text>)}
      </Card>
      <Card>
        <H2>Weekly timetable</H2>
        {r.loading ? <Muted>Loading…</Muted> : r.data.length === 0
          ? <Muted>No schedules yet. Open the Schedules tab to add the first class.</Muted>
          : <Timetable schedules={r.data} />}
      </Card>
    </View>
  );
}
