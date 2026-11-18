import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api } from '../lib/api'
import { Btn } from './ui'
import { C, FONT } from '../theme'

// Admin notifications: classes in unavailable rooms and instructors over their hour limit.
export default function Bell({ go, mobile }) {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const load = () =>
    api
      .get('/api/alerts')
      .then((r) => setAlerts(r.data))
      .catch(() => {})
  useEffect(() => {
    load()
  }, [])

  return (
    <View>
      <Pressable
        onPress={() => {
          if (!open) load()
          setOpen((v) => !v)
        }}
        accessibilityRole="button"
        accessibilityLabel={`Notifications${alerts.length ? `, ${alerts.length} new` : ''}`}
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#CBD2DC',
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 16,
              height: 13,
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              borderWidth: 2,
              borderBottomWidth: 0,
              borderColor: C.ink,
            }}
          />
          <View style={{ width: 20, height: 2, backgroundColor: C.ink }} />
          <View
            style={{
              width: 5,
              height: 3,
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
              backgroundColor: C.ink,
              marginTop: 1,
            }}
          />
        </View>
        {alerts.length > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: C.danger,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <Text
              style={[FONT, { fontSize: 10, fontWeight: '700', color: '#fff' }]}
            >
              {alerts.length}
            </Text>
          </View>
        )}
      </Pressable>
      {open && (
        <View
          style={{
            position: 'absolute',
            top: 48,
            right: mobile ? -52 : 0,
            width: 300,
            zIndex: 6,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 12,
            padding: 14,
            gap: 10,
          }}
        >
          <Text
            style={[FONT, { fontSize: 15, fontWeight: '600', color: C.ink }]}
          >
            Notifications
          </Text>
          {alerts.length === 0 ? (
            <Text style={[FONT, { fontSize: 14, color: C.muted }]}>
              No new notifications.
            </Text>
          ) : (
            alerts.map((a, i) => (
              <Text key={i} style={[FONT, { fontSize: 14, color: C.danger }]}>
                • {a.message}
              </Text>
            ))
          )}
          <Btn
            small
            title="Open dashboard"
            onPress={() => {
              setOpen(false)
              go('Dashboard')
            }}
          />
        </View>
      )}
    </View>
  )
}
