import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import { C, FONT } from '../theme';

// Header search across subjects, instructors and rooms. Picking a result opens that tab, filtered.
export default function SearchBox({ go }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [res, setRes] = useState(null);

  useEffect(() => {
    if (debounced.trim().length < 2) { setRes(null); return; }
    api.get(`/api/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((r) => setRes(r.data)).catch(() => setRes(null));
  }, [debounced]);

  const groups = res ? [
    ['Subjects', 'Subjects', res.subjects.map((s) => ({ id: s.id, label: `${s.code} ${s.name}`, term: s.code }))],
    ['Instructors', 'Instructors', res.instructors.map((i) => ({ id: i.id, label: i.name, term: i.name }))],
    ['Rooms', 'Rooms', res.rooms.map((r) => ({ id: r.id, label: `${r.building ? r.building + ' ' : ''}${r.name}`, term: r.name }))],
  ].filter(([, , items]) => items.length) : [];

  const pick = (tab, term) => { go(tab, { search: term }); setQ(''); setRes(null); };

  return (
    <View style={{ width: 220 }}>
      <TextInput
        value={q} onChangeText={setQ} placeholder="Search all records" accessibilityLabel="Search all records"
        placeholderTextColor="#8A94A6"
        style={[FONT, { height: 44, borderWidth: 1, borderColor: '#CBD2DC', borderRadius: 8, paddingHorizontal: 14, fontSize: 14, color: C.ink, backgroundColor: '#fff' }]}
      />
      {res && (
        <View style={{ position: 'absolute', top: 48, left: 0, width: 320, zIndex: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 8 }}>
          {groups.length === 0 && <Text style={[FONT, { padding: 10, fontSize: 14, color: C.muted }]}>No matches.</Text>}
          {groups.map(([title, tab, items]) => (
            <View key={title}>
              <Text style={[FONT, { paddingHorizontal: 10, paddingTop: 8, fontSize: 12, fontWeight: '600', color: C.muted }]}>{title}</Text>
              {items.map((it) => (
                <Pressable key={it.id} onPress={() => pick(tab, it.term)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 }}>
                  <Text style={[FONT, { fontSize: 14, color: C.ink }]} numberOfLines={1}>{it.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
