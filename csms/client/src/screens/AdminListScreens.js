import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../hooks/useAuth';
import { Banner, Btn, Card, Field, H1, H2, Muted, Select } from '../components/ui';
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

const ROLE_LABEL = { admin: 'Admin', instructor: 'Instructor', student: 'Student', viewer: 'Not linked (no access)' };
const blankInvite = { full_name: '', email: '', role: 'instructor', instructor_id: '' };

export function UsersScreen() {
  const { session } = useAuth();
  const r = useResource('/api/users', { sort: 'created_at' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [invite, setInvite] = useState(null); // null = closed
  const [free, setFree] = useState([]); // instructor records that have no login yet
  const [busy, setBusy] = useState(false);

  const change = async (id, role) => {
    try { await api.put(`/api/users/${id}/role`, { role }); setError(''); r.reload(); } catch (e) { setError(e.message); }
  };

  const openInvite = async () => {
    setInvite(blankInvite); setError(''); setNotice('');
    try {
      const { data } = await api.get('/api/instructors?pageSize=200');
      setFree(data.filter((i) => !i.user_id));
    } catch (e) { setError(e.message); }
  };
  const pickInstructor = (id) => {
    const rec = free.find((i) => i.id === id);
    setInvite((f) => ({ ...f, instructor_id: id, full_name: f.full_name || rec?.name || '', email: f.email || rec?.email || '' }));
  };
  const send = async () => {
    setError(''); setNotice('');
    setBusy(true);
    try {
      await api.post('/api/users/invite', invite);
      setNotice(`Invitation sent to ${invite.email}. They choose a password from the email, then sign in.`);
      setInvite(null); r.reload();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ gap: 6 }}>
          <H1>Users</H1>
          <Muted>Instructor and administrator accounts are created here, by invitation. Student accounts are managed in the Students tab.</Muted>
        </View>
        <Btn kind="primary" title="Invite user" onPress={openInvite} />
      </View>
      <Banner>{error || r.error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      {invite && (
        <Card style={{ gap: 14 }}>
          <H2>Invite a user</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Select label="Role" value={invite.role} onChange={(v) => setInvite({ ...invite, role: v, instructor_id: '' })}
              options={[{ value: 'instructor', label: 'Instructor' }, { value: 'admin', label: 'Admin / scheduler' }]} />
            {invite.role === 'instructor' && (
              <Select label="Instructor record" value={invite.instructor_id} onChange={pickInstructor}
                options={[{ value: '', label: free.length ? 'Select…' : 'No instructor without a login. Add one first.' }, ...free.map((i) => ({ value: i.id, label: i.name }))]} />
            )}
            <Field label="Full name" value={invite.full_name} onChangeText={(v) => setInvite({ ...invite, full_name: v })} />
            <Field label="Email" value={invite.email} onChangeText={(v) => setInvite({ ...invite, email: v })} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <Muted>They receive an email to choose a password. Nobody can become an instructor or admin by signing up on their own.</Muted>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn kind="primary" title={busy ? 'Sending…' : 'Send invitation'} onPress={send} disabled={busy} />
            <Btn title="Cancel" onPress={() => setInvite(null)} />
          </View>
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        {r.data.map((u) => (
          <View key={u.id} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={[FONT, { fontSize: 14, color: C.ink }]}>
                {u.full_name || 'Unnamed user'}{u.id === session?.user?.id ? ' (you)' : ''}
              </Text>
              <Muted style={{ fontSize: 13 }}>{u.email || ''}</Muted>
            </View>
            <Select label="Role" value={u.role} onChange={(v) => change(u.id, v)}
              options={[{ value: 'admin', label: ROLE_LABEL.admin }, { value: 'instructor', label: ROLE_LABEL.instructor }, { value: 'viewer', label: ROLE_LABEL.viewer }]}
              style={{ flexBasis: 220, flexGrow: 0 }} />
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
        <Muted>Role: {ROLE_LABEL[profile?.role] || profile?.role}</Muted>
        {profile?.student && (
          <>
            <Muted>Student number: {profile.student.student_number}</Muted>
            <Muted>
              {[profile.student.course, profile.student.year_level ? `Year ${profile.student.year_level}` : '', profile.student.section?.section_name].filter(Boolean).join(' · ')}
            </Muted>
          </>
        )}
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Btn title="Sign out" onPress={signOut} /></View>
      </Card>
    </View>
  );
}
