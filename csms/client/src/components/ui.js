import React from 'react'
import { Pressable, Text, View, TextInput, Platform } from 'react-native'
import { C, FONT } from '../theme'

export function Btn({
  title,
  onPress,
  kind = 'default',
  small,
  big,
  disabled,
  style,
}) {
  const primary = kind === 'primary'
  const danger = kind === 'danger'
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          minHeight: big ? 54 : small ? 36 : 44,
          minWidth: big ? 150 : undefined,
          paddingHorizontal: small ? 12 : 18,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: primary ? C.blue : danger ? C.danger : '#CBD2DC',
          backgroundColor: primary ? C.blue : '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          FONT,
          {
            fontWeight: '600',
            fontSize: big ? 17 : small ? 13 : 14,
            color: primary ? '#fff' : danger ? C.danger : C.ink,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  )
}

export const Card = ({ style, children }) => (
  <View
    style={[
      {
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 20,
      },
      style,
    ]}
  >
    {children}
  </View>
)

export const H1 = ({ children }) => (
  <Text
    accessibilityRole="header"
    style={[FONT, { fontSize: 28, fontWeight: '700', color: C.ink }]}
  >
    {children}
  </Text>
)
export const H2 = ({ children }) => (
  <Text
    accessibilityRole="header"
    style={[
      FONT,
      { fontSize: 17, fontWeight: '600', color: C.ink, marginBottom: 12 },
    ]}
  >
    {children}
  </Text>
)
export const Muted = ({ children, style }) => (
  <Text style={[FONT, { fontSize: 14, color: C.muted }, style]}>
    {children}
  </Text>
)

export function Field({
  label,
  style,
  rightAccessory,
  ...props
}) {
  const input = (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor="#8A94A6"
      {...props}
      style={[
        FONT,
        {
          height: 44,
          borderWidth: 1,
          borderColor: '#CBD2DC',
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingRight: rightAccessory ? 44 : 12,
          fontSize: 14,
          color: C.ink,
          backgroundColor: '#fff',
        },
      ]}
    />
  )

  return (
    <View style={[{ flexGrow: 1, flexBasis: 160, gap: 6 }, style]}>
      <Text style={[FONT, { fontSize: 13, fontWeight: '500', color: C.muted }]}>
        {label}
      </Text>
      {rightAccessory ? (
        <View style={{ position: 'relative' }}>
          {input}
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 4,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            {rightAccessory}
          </View>
        </View>
      ) : (
        input
      )}
    </View>
  )
}

function VisibilityIcon({ visible }) {
  return (
    <View
      style={{
        width: 22,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 19,
          height: 12,
          borderWidth: 1.5,
          borderColor: C.muted,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: C.muted,
          }}
        />
      </View>
      {!visible && (
        <View
          style={{
            position: 'absolute',
            width: 24,
            height: 1.5,
            backgroundColor: C.muted,
            transform: [{ rotate: '45deg' }],
          }}
        />
      )}
    </View>
  )
}

export function PasswordField({ label = 'Password', ...props }) {
  const [visible, setVisible] = React.useState(false)

  return (
    <Field
      label={label}
      {...props}
      secureTextEntry={!visible}
      rightAccessory={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          accessibilityState={{ pressed: visible }}
          onPress={() => setVisible((current) => !current)}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VisibilityIcon visible={visible} />
        </Pressable>
      }
    />
  )
}

// Native <select> on the web. options: array of strings or {value,label}.
export function Select({ label, value, onChange, options, style, compact }) {
  const opts = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  return (
    <View
      style={[
        {
          flexGrow: compact ? 0 : 1,
          flexBasis: compact ? undefined : 160,
          gap: 6,
        },
        style,
      ]}
    >
      {!compact && (
        <Text
          style={[FONT, { fontSize: 13, fontWeight: '500', color: C.muted }]}
        >
          {label}
        </Text>
      )}
      {Platform.OS === 'web' ? (
        React.createElement(
          'select',
          {
            value: value ?? '',
            'aria-label': label,
            onChange: (e) => onChange(e.target.value),
            style: {
              height: compact ? 36 : 44,
              borderRadius: 8,
              border: '1px solid #CBD2DC',
              padding: '0 10px',
              fontSize: compact ? 13 : 14,
              fontFamily: 'inherit',
              background: '#fff',
              color: C.ink,
            },
          },
          opts.map((o) =>
            React.createElement(
              'option',
              { key: o.value, value: o.value },
              o.label,
            ),
          ),
        )
      ) : (
        <TextInput
          value={String(value ?? '')}
          onChangeText={onChange}
          style={{
            height: 44,
            borderWidth: 1,
            borderColor: '#CBD2DC',
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        />
      )}
    </View>
  )
}

export function Banner({ kind = 'error', children }) {
  if (!children) return null
  const err = kind === 'error'
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: err ? C.dangerBg : C.okBg,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <Text style={[FONT, { fontSize: 14, color: err ? C.danger : C.ok }]}>
        {children}
      </Text>
    </View>
  )
}

export const confirmAction = (message) =>
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.confirm(message)
    : true
