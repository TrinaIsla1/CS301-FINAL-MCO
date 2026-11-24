import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { Banner, Btn, Card, H1, H2, Muted, Select } from '../components/ui';
import { C, DAYS, FONT } from '../theme';

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
  const userMetadata = session?.user?.user_metadata || {};
  if (profile?.role === 'viewer') {
    return (
      <ViewerProfile
        profile={profile}
        session={session}
        signOut={signOut}
        userMetadata={userMetadata}
      />
    );
  }

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

function ViewerProfile({ profile, session, signOut, userMetadata }) {
  const mobile = useIsMobile();
  const schedules = useResource('/api/schedules', { sort: 'day_of_week' });
  const program = String(userMetadata.program || '').trim();
  const section = String(userMetadata.section || '').trim();
  const normalize = (value) => String(value || '').replace(/\s/g, '').toUpperCase();
  const programKey = normalize(program);
  const sectionKey = normalize(section);
  const rows = schedules.data.filter((schedule) => {
    const scheduleSection = normalize(schedule.section);
    const scheduleProgram = normalize(
      schedule.program ||
        schedule.program_name ||
        scheduleSection.slice(0, programKey.length),
    );
    return (
      !!programKey &&
      !!sectionKey &&
      scheduleSection === sectionKey &&
      scheduleProgram === programKey
    );
  });
  const name =
    userMetadata.full_name || profile?.name || 'Unnamed user';
  const studentNo = userMetadata.student_no || userMetadata.studentNo;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  const time = (value) => String(value || '').slice(0, 5);

  return (
    <View style={{ gap: 20 }}>
      <H1>Profile</H1>
      <Card style={{ gap: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 1,
              minWidth: 220,
              gap: 14,
            }}
          >
            <View
              accessibilityLabel={`Avatar for ${name}`}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: C.blueSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[FONT, { color: C.blue, fontSize: 20, fontWeight: '700' }]}>
                {initials}
              </Text>
            </View>
            <View style={{ gap: 5, flexShrink: 1 }}>
              <Text
                style={[
                  FONT,
                  { color: C.ink, fontSize: 20, fontWeight: '700' },
                ]}
                numberOfLines={2}
              >
                {name}
              </Text>
              <Muted>{session?.user?.email || 'No email available'}</Muted>
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: C.blueSoft,
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={[
                    FONT,
                    { color: C.blue, fontSize: 12, fontWeight: '600' },
                  ]}
                >
                  Viewer
                </Text>
              </View>
            </View>
          </View>
          <Btn
            title="Sign out"
            onPress={signOut}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 20,
            borderTopWidth: 1,
            borderTopColor: C.border,
            paddingTop: 16,
          }}
        >
          {studentNo && (
            <View style={{ flexGrow: 1, flexBasis: 140, gap: 5 }}>
              <Muted>Student No.</Muted>
              <Text style={[FONT, { color: C.ink, fontSize: 14 }]}>
                {studentNo}
              </Text>
            </View>
          )}
          <View style={{ flexGrow: 1, flexBasis: 140, gap: 5 }}>
            <Muted>Program</Muted>
            <Text style={[FONT, { color: C.ink, fontSize: 14 }]}>
              {program || '—'}
            </Text>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 140, gap: 5 }}>
            <Muted>Section</Muted>
            <Text style={[FONT, { color: C.ink, fontSize: 14 }]}>
              {section || '—'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: 12 }}>
        <H2>My Class Schedule</H2>
        <Banner>{schedules.error}</Banner>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {schedules.loading ? (
            <Muted style={{ padding: 16 }}>Loading your schedule…</Muted>
          ) : rows.length === 0 ? (
            <Muted style={{ padding: 16 }}>No schedule posted yet.</Muted>
          ) : mobile ? (
            rows.map((schedule) => (
              <View
                key={schedule.id}
                style={{
                  gap: 6,
                  padding: 16,
                  borderTopWidth: 1,
                  borderTopColor: C.border,
                }}
              >
                <Text
                  style={[
                    FONT,
                    { color: C.ink, fontSize: 15, fontWeight: '600' },
                  ]}
                >
                  {schedule.subject?.code || '—'} ·{' '}
                  {schedule.subject?.name || 'Subject'}
                </Text>
                <Muted>
                  {DAYS[schedule.day_of_week - 1] || 'Day'} ·{' '}
                  {time(schedule.start_time)}–{time(schedule.end_time)}
                </Muted>
                <Muted>
                  {schedule.room?.name || 'Room not assigned'} ·{' '}
                  {schedule.instructor?.name || 'Instructor not assigned'}
                </Muted>
              </View>
            ))
          ) : (
            <ScrollView horizontal>
              <View style={{ minWidth: 760 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: C.head,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                  }}
                >
                  {['Subject', 'Day', 'Time', 'Room', 'Instructor'].map(
                    (label, index) => (
                      <Text
                        key={label}
                        style={[
                          FONT,
                          {
                            flex: [2, 0.8, 1, 1, 1.2][index],
                            padding: 12,
                            color: C.muted,
                            fontSize: 12,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    ),
                  )}
                </View>
                {rows.map((schedule) => (
                  <View
                    key={schedule.id}
                    style={{
                      flexDirection: 'row',
                      borderBottomWidth: 1,
                      borderBottomColor: C.border,
                    }}
                  >
                    {[
                      `${schedule.subject?.code || '—'} · ${schedule.subject?.name || 'Subject'}`,
                      DAYS[schedule.day_of_week - 1] || '—',
                      `${time(schedule.start_time)}–${time(schedule.end_time)}`,
                      schedule.room?.name || '—',
                      schedule.instructor?.name || '—',
                    ].map((value, index) => (
                      <Text
                        key={index}
                        style={[
                          FONT,
                          {
                            flex: [2, 0.8, 1, 1, 1.2][index],
                            minWidth: 0,
                            padding: 12,
                            color: C.ink,
                            fontSize: 13,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {value}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </Card>
      </View>
    </View>
  );
}
