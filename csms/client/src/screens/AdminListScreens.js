import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../hooks/useAuth';
import { Banner, Btn, Card, H1, Muted, Select } from '../components/ui';
import { C, FONT } from '../theme';

const when = (iso) => new Date(iso).toLocaleString();

export function AuditScreen() {
  const [state, setState] = React.useState({ rows: [], error: '', loading: true });
  React.useEffect(() => {
    api.get('/api/audit-logs')
      .then((r) => setState({ rows: r.data, error: '', loading: false }))
      .catch((e) => setState({ rows: [], error: e.message, loading: false }));
  }, []);
  return (
    <View style={{ gap: 20 }}>
      <H1>Audit log</H1>
      <Banner>{state.error}</Banner>
      <Card style={{ padding: 0 }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 640, flex: 1 }}>
            {state.loading && <Muted style={{ padding: 16 }}>Loading…</Muted>}
            {!state.loading && state.rows.length === 0 && <Muted style={{ padding: 16 }}>No changes recorded yet.</Muted>}
            {state.rows.map((l) => (
              <View key={l.id} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={[FONT, { flex: 1.4, fontSize: 13, color: C.muted }]}>{when(l.created_at)}</Text>
                <Text style={[FONT, { flex: 1.6, fontSize: 14, color: C.ink }]}>{l.user_email}</Text>
                <Text style={[FONT, { flex: 2, fontSize: 14, color: C.ink }]}>{l.action} {l.entity}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
}

export function UsersScreen() {
  const { session } = useAuth();
  const r = useResource('/api/users', { sort: 'created_at' });
  const [error, setError] = useState('');
  const change = async (id, role) => {
    try { await api.put(`/api/users/${id}/role`, { role }); setError(''); r.reload(); } catch (e) { setError(e.message); }
  };
  return (
    <View style={{ gap: 20 }}>
      <H1>Users</H1>
      <Muted>Choose what each person can do. New accounts start as viewers.</Muted>
      <Banner>{error || r.error}</Banner>
      <Card style={{ gap: 12 }}>
        {r.data.map((u) => (
          <View key={u.id} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <Text style={[FONT, { flex: 1, minWidth: 160, fontSize: 14, color: C.ink }]}>
              {u.full_name || 'Unnamed user'}{u.id === session?.user?.id ? ' (you)' : ''}
            </Text>
            <Select label="Role" value={u.role} onChange={(v) => change(u.id, v)} options={['admin', 'instructor', 'viewer']} style={{ flexBasis: 160, flexGrow: 0 }} />
          </View>
        ))}
      </Card>
    </View>
  );
}

export function ProfileScreen() {
  const { profile, session, signOut } = useAuth();
  return (
    <View style={{ gap: 20 }}>
      <H1>Profile</H1>
      <Card style={{ gap: 8 }}>
        <Text style={[FONT, { fontSize: 16, fontWeight: '600', color: C.ink }]}>{profile?.name || 'Unnamed user'}</Text>
        <Muted>{session?.user?.email}</Muted>
        <Muted>Role: {profile?.role}</Muted>
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Btn title="Sign out" onPress={signOut} /></View>
      </Card>
    </View>
  );
}
