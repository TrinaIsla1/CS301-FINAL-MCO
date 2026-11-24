import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from './src/hooks/useAuth'
import { useIsMobile } from './src/hooks/useIsMobile'
import AuthScreen from './src/screens/AuthScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import ResourceScreen from './src/screens/ResourceScreen'
import TimetableScreen from './src/screens/TimetableScreen'
import AvailabilityScreen from './src/screens/AvailabilityScreen'
import ViewerLoginScreen from './src/screens/ViewerLoginScreen'
import SearchBox from './src/components/SearchBox'
import Bell from './src/components/Bell'
import { ProfileScreen } from './src/screens/AdminListScreens'
import * as resources from './src/config/resources'
import { Btn } from './src/components/ui'
import { C, FONT } from './src/theme'

// Tabs per role. Admin navigation focuses on the dashboard and core resources.
// Each tab renders with `go` (switch tab) and `intent` (what the switch asked for).
const TABS = {
  admin: [
    ['Dashboard', (go) => <DashboardScreen go={go} />],
    [
      'Subjects',
      (go, i) => (
        <ResourceScreen
          config={resources.subjects}
          canEdit
          autoAdd={i.add}
          autoSearch={i.search}
        />
      ),
    ],
    [
      'Instructors',
      (go, i) => (
        <ResourceScreen
          config={resources.instructors}
          canEdit
          autoAdd={i.add}
          autoSearch={i.search}
        />
      ),
    ],
    [
      'Rooms',
      (go, i) => (
        <ResourceScreen
          config={resources.rooms}
          canEdit
          autoAdd={i.add}
          autoSearch={i.search}
        />
      ),
    ],
  ],
  instructor: [
    ['My Schedule', () => <TimetableScreen title="My Schedule" mine />],
    ['My Availability', () => <AvailabilityScreen />],
    ['Profile', () => <ProfileScreen />],
  ],
  viewer: [
    ['Profile', () => <ProfileScreen />],
  ],
}

// Blue square mark with three lines, as in the design.
function Logo() {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: C.blue,
        justifyContent: 'center',
        paddingLeft: 8,
        gap: 3,
      }}
    >
      {[14, 9, 12].map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            height: 2.4,
            borderRadius: 2,
            backgroundColor: '#fff',
          }}
        />
      ))}
    </View>
  )
}

function Brand({ role, admin }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
      }}
    >
      {admin && <Logo />}
      <Text style={[FONT, { fontSize: 17, fontWeight: '700', color: C.ink }]}>
        CSMS
        {!admin && (
          <Text style={{ fontSize: 13, fontWeight: '500', color: C.muted }}>
            {' '}
            {role[0].toUpperCase() + role.slice(1)}
          </Text>
        )}
      </Text>
    </View>
  )
}

// Account button: the Admin gets an initials badge, others a plain name button.
function UserButton({ name, admin, onPress }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AD'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Account menu"
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD2DC',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {admin && (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: C.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[FONT, { fontSize: 12, color: '#fff' }]}>
            {initials}
          </Text>
        </View>
      )}
      <Text
        style={[FONT, { fontSize: 14, fontWeight: '600', color: C.ink }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  )
}

// Three-line button that opens the tab menu on phones (X while open).
function MenuButton({ open, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={open ? 'Close menu' : 'Open menu'}
      accessibilityState={{ expanded: open }}
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD2DC',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      {open ? (
        <Text style={[FONT, { fontSize: 18, color: C.ink }]}>✕</Text>
      ) : (
        [0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 18,
              height: 2,
              borderRadius: 1,
              backgroundColor: C.ink,
            }}
          />
        ))
      )}
    </Pressable>
  )
}

function Shell() {
  const {
    session,
    profile,
    loading,
    profileSyncError,
    signOut,
  } = useAuth()
  const mobile = useIsMobile()
  const viewerEntry =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('portal') === 'viewer'
  const [tab, setTab] = useState(0)
  const [intent, setIntent] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  useEffect(() => {
    setTab(0)
    setIntent({})
  }, [profile?.role])
  useEffect(() => {
    if (!mobile) setMenuOpen(false)
  }, [mobile])

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={C.blue} />
      </View>
    )
  if (!session) return viewerEntry ? <ViewerLoginScreen /> : <AuthScreen />
  if (!profile) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <ActivityIndicator color={C.blue} />
        <Text style={FONT}>Loading your account…</Text>
        <Btn small title="Sign out" onPress={signOut} />
      </View>
    )
  }
  if (viewerEntry && profileSyncError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          padding: 24,
          backgroundColor: C.bg,
        }}
      >
        <Text style={[FONT, { color: C.danger, textAlign: 'center' }]}>
          {profileSyncError}
        </Text>
        <Btn title="Sign out" onPress={signOut} />
      </View>
    )
  }
  if (viewerEntry && profile.role !== 'viewer') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          padding: 24,
          backgroundColor: C.bg,
        }}
      >
        <Text style={[FONT, { color: C.ink, textAlign: 'center' }]}>
          This sign-in link is for Viewer accounts only.
        </Text>
        <Btn title="Sign out" onPress={signOut} />
      </View>
    )
  }

  const admin = profile.role === 'admin'
  const tabs = TABS[profile.role] || TABS.viewer
  const current = Math.min(tab, tabs.length - 1)
  const [, render] = tabs[current]
  const go = (name, opts = {}) => {
    const i = tabs.findIndex(([n]) => n === name)
    if (i < 0) return
    setTab(i)
    setIntent({
      add: opts.add ? Date.now() : 0,
      edit: opts.edit || null,
      search: opts.search || '',
    })
    setMenuOpen(false)
    setUserOpen(false)
  }
  const name = profile.name || (admin ? 'Admin' : 'Account')
  const userButton = (
    <UserButton
      name={name}
      admin={admin}
      onPress={() => {
        setUserOpen((v) => !v)
        setMenuOpen(false)
      }}
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          paddingHorizontal: mobile ? 16 : 32,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mobile ? 8 : 28,
          zIndex: 3,
        }}
      >
        <View style={mobile ? { flex: 1 } : { flexShrink: 0 }}>
          <Brand role={profile.role} admin={admin} />
        </View>
        {mobile ? (
          <>
            {admin && <Bell go={go} mobile />}
            {!admin && userButton}
            <MenuButton
              open={menuOpen}
              onPress={() => {
                setMenuOpen((v) => !v)
                setUserOpen(false)
              }}
            />
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              {tabs.map(([n], i) => (
                <Pressable
                  key={n}
                  onPress={() => go(n)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === current }}
                  style={{
                    paddingVertical: 14,
                    marginRight: 22,
                    borderBottomWidth: 3,
                    borderBottomColor: i === current ? C.blue : 'transparent',
                  }}
                >
                  <Text
                    style={[
                      FONT,
                      {
                        fontSize: 14,
                        fontWeight: i === current ? '600' : '500',
                        color: i === current ? C.blue : C.muted,
                      },
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {admin && <SearchBox go={go} />}
            {admin && <Bell go={go} />}
            {userButton}
          </>
        )}
      </View>

      {userOpen && (
        <>
          <Pressable
            accessibilityLabel="Close account menu"
            onPress={() => setUserOpen(false)}
            style={{
              position: 'absolute',
              top: 56,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 60,
              right: mobile ? 16 : 32,
              zIndex: 4,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 12,
              padding: 14,
              gap: 10,
              minWidth: 220,
            }}
          >
            <Text
              style={[FONT, { fontSize: 13, color: C.muted }]}
              numberOfLines={1}
            >
              {session.user.email}
            </Text>
            <Btn title="Sign out" onPress={signOut} />
          </View>
        </>
      )}

      {mobile && menuOpen && (
        <>
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => setMenuOpen(false)}
            style={{
              position: 'absolute',
              top: 56,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(20,33,61,0.45)',
              zIndex: 1,
            }}
          />
          <View
            accessibilityRole="menu"
            style={{
              position: 'absolute',
              top: 56,
              left: 0,
              right: 0,
              zIndex: 2,
              backgroundColor: '#fff',
              paddingHorizontal: 16,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            {tabs.map(([n], i) => (
              <Pressable
                key={n}
                onPress={() => go(n)}
                accessibilityRole="menuitem"
                style={{
                  minHeight: 48,
                  justifyContent: 'center',
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                }}
              >
                <Text
                  style={[
                    FONT,
                    {
                      fontSize: 15,
                      fontWeight: i === current ? '600' : '500',
                      color: i === current ? C.blue : C.ink,
                    },
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={signOut}
              accessibilityRole="menuitem"
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <Text
                style={[
                  FONT,
                  { fontSize: 15, fontWeight: '500', color: C.danger },
                ]}
              >
                Sign out
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <ScrollView
        contentContainerStyle={{
          padding: mobile ? 16 : 32,
          maxWidth: 1280,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {render(go, intent)}
      </ScrollView>
    </View>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Shell />
    </AuthProvider>
  )
}
