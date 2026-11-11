import React from 'react';
import { Pressable, Text, View, TextInput, Platform } from 'react-native';
import { C, FONT } from '../theme';

export function Btn({ title, onPress, kind = 'default', small, disabled, style }) {
  const primary = kind === 'primary';
  const danger = kind === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[{
        minHeight: small ? 36 : 44,
        paddingHorizontal: small ? 12 : 18,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: primary ? C.blue : danger ? C.danger : '#CBD2DC',
        backgroundColor: primary ? C.blue : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      <Text style={[FONT, { fontWeight: '600', fontSize: small ? 13 : 14, color: primary ? '#fff' : danger ? C.danger : C.ink }]}>{title}</Text>
    </Pressable>
  );
}

export const Card = ({ style, children }) => (
  <View style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 20 }, style]}>{children}</View>
);

export const H1 = ({ children }) => <Text accessibilityRole="header" style={[FONT, { fontSize: 28, fontWeight: '700', color: C.ink }]}>{children}</Text>;
export const H2 = ({ children }) => <Text accessibilityRole="header" style={[FONT, { fontSize: 17, fontWeight: '600', color: C.ink, marginBottom: 12 }]}>{children}</Text>;
export const Muted = ({ children, style }) => <Text style={[FONT, { fontSize: 14, color: C.muted }, style]}>{children}</Text>;

export function Field({ label, style, ...props }) {
  return (
    <View style={[{ flexGrow: 1, flexBasis: 160, gap: 6 }, style]}>
      <Text style={[FONT, { fontSize: 13, fontWeight: '500', color: C.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8A94A6"
        {...props}
        style={[FONT, { height: 44, borderWidth: 1, borderColor: '#CBD2DC', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: C.ink, backgroundColor: '#fff' }]}
      />
    </View>
  );
}

// Native <select> on the web. options: array of strings or {value,label}.
export function Select({ label, value, onChange, options, style }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <View style={[{ flexGrow: 1, flexBasis: 160, gap: 6 }, style]}>
      <Text style={[FONT, { fontSize: 13, fontWeight: '500', color: C.muted }]}>{label}</Text>
      {Platform.OS === 'web'
        ? React.createElement(
            'select',
            {
              value: value ?? '',
              'aria-label': label,
              onChange: (e) => onChange(e.target.value),
              style: { height: 44, borderRadius: 8, border: '1px solid #CBD2DC', padding: '0 10px', fontSize: 14, fontFamily: 'inherit', background: '#fff', color: C.ink },
            },
            opts.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))
          )
        : <TextInput value={String(value ?? '')} onChangeText={onChange} style={{ height: 44, borderWidth: 1, borderColor: '#CBD2DC', borderRadius: 8, paddingHorizontal: 12 }} />}
    </View>
  );
}

export function Banner({ kind = 'error', children }) {
  if (!children) return null;
  const err = kind === 'error';
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: err ? C.dangerBg : C.okBg, borderRadius: 8, padding: 12 }}>
      <Text style={[FONT, { fontSize: 14, color: err ? C.danger : C.ok }]}>{children}</Text>
    </View>
  );
}

export const confirmAction = (message) =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.confirm(message) : true;
