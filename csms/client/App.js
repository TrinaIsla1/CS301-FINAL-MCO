import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { useIsMobile } from './src/hooks/useIsMobile';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ResourceScreen from './src/screens/ResourceScreen';
import SchedulesScreen from './src/screens/SchedulesScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import { AuditScreen, UsersScreen, ProfileScreen } from './src/screens/AdminListScreens';
import * as resources from './src/config/resources';
import { Btn } from './src/components/ui';
import { C, FONT } from './src/theme';

// Tabs per role. The Admin controls the whole scheduling process.
const TABS = {
  admin: [
    ['Dashboard', () => <DashboardScreen />],
    ['Subjects', () => <ResourceScreen config={resources.subjects} canEdit />],
    ['Instructors', () => <ResourceScreen config={resources.instructors} canEdit />],
    ['Rooms', () => <ResourceScreen config={resources.rooms} canEdit />],
    ['Schedules', () => <SchedulesScreen />],
    ['Users', () => <UsersScreen />],
    ['Audit Log', () => <AuditScreen />],
  ],
  instructor: [
    ['My Schedule', () => <TimetableScreen title="My Schedule" mine />],
    ['Profile', () => <ProfileScreen />],
  ],
  viewer: [
    ['Timetable', () => <TimetableScreen title="Class Timetable" />],
    ['Subjects', () => <ResourceScreen config={resources.subjects} />],
    ['Rooms', () => <ResourceScreen config={resources.rooms} />],
    ['Profile', () => <ProfileScreen />],
  ],
};

// Three-line button that opens the tab menu on phones (X while open).
function MenuButton({ open, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={open ? 'Close menu' : 'Open menu'}
      accessibilityState={{ expanded: open }}
      style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#CBD2DC', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      {open
        ? <Text style={[FONT, { fontSize: 18, color: C.ink }]}>✕</Text>
        : [0, 1, 2].map((i) => <View key={i} style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: C.ink }} />)}
    </Pressable>
  );
}

function Shell() {
  const { session, profile, loading, signOut } = useAuth();
  const mobile = useIsMobile();
  const [tab, setTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setTab(0), [profile?.role]);
  useEffect(() => { if (!mobile) setMenuOpen(false); }, [mobile]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.blue} /></View>;
  if (!session) return <AuthScreen />;
  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator color={C.blue} /><Text style={FONT}>Loading your account…</Text><Btn small title="Sign out" onPress={signOut} />
      </View>
    );
  }

  const tabs = TABS[profile.role] || TABS.viewer;
  const current = Math.min(tab, tabs.length - 1);
  const [, render] = tabs[current];
  const choose = (i) => { setTab(i); setMenuOpen(false); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: mobile ? 16 : 24, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 24, zIndex: 3 }}>
        <Text style={[FONT, { fontSize: 17, fontWeight: '700', color: C.ink, flex: mobile ? 1 : 0 }]}>
          CSMS <Text style={{ fontSize: 13, fontWeight: '500', color: C.muted }}>{profile.role}</Text>
        </Text>
        {mobile ? (
          <MenuButton open={menuOpen} onPress={() => setMenuOpen((v) => !v)} />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {tabs.map(([name], i) => (
                <Pressable key={name} onPress={() => choose(i)} accessibilityRole="tab" accessibilityState={{ selected: i === current }}
                  style={{ paddingVertical: 14, marginRight: 22, borderBottomWidth: 3, borderBottomColor: i === current ? C.blue : 'transparent' }}>
                  <Text style={[FONT, { fontSize: 14, fontWeight: i === current ? '600' : '500', color: i === current ? C.blue : C.muted }]}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Btn small title="Sign out" onPress={signOut} />
          </>
        )}
      </View>

      {mobile && menuOpen && (
        <>
          <Pressable accessibilityLabel="Close menu" onPress={() => setMenuOpen(false)}
            style={{ position: 'absolute', top: 56, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,33,61,0.45)', zIndex: 1 }} />
          <View accessibilityRole="menu" style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 2, backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
            {tabs.map(([name], i) => (
              <Pressable key={name} onPress={() => choose(i)} accessibilityRole="menuitem"
                style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={[FONT, { fontSize: 15, fontWeight: i === current ? '600' : '500', color: i === current ? C.blue : C.ink }]}>{name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={signOut} accessibilityRole="menuitem" style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[FONT, { fontSize: 15, fontWeight: '500', color: C.danger }]}>Sign out</Text>
            </Pressable>
          </View>
        </>
      )}

      <ScrollView contentContainerStyle={{ padding: mobile ? 16 : 32, maxWidth: 1280, width: '100%', alignSelf: 'center' }}>
        {render()}
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Shell />
    </AuthProvider>
  );
}
