import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useResource } from '../hooks/useResource';
import { Banner, Btn, Card, Field, H1, H2, Muted, Select, confirmAction } from '../components/ui';
import { C, FONT } from '../theme';

const defaults = (fields) =>
  Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === 'bool' ? true : '')]));

// Turn form strings into the types the API expects; blanks become null.
function coerce(fields, form) {
  const out = {};
  for (const f of fields) {
    const v = form[f.key];
    if (f.type === 'number') out[f.key] = v === '' || v == null ? null : Number(v);
    else if (f.type === 'bool') out[f.key] = v === true || v === 'true';
    else out[f.key] = v === '' ? null : v;
  }
  return out;
}

const show = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v ?? '');

// One screen for Subjects, Instructors and Rooms: search, sort, add, edit, delete.
export default function ResourceScreen({ config, canEdit }) {
  const { title, path, columns, fields, defaultSort } = config;
  const r = useResource(path, { sort: defaultSort });
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = editing
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const open = (row) => {
    setEditing(row || {});
    setForm(row ? { ...row } : defaults(fields));
    setMessage(''); setError('');
  };

  const save = async () => {
    const missing = fields.find((f) => f.required && (form[f.key] === '' || form[f.key] == null));
    if (missing) return setError(`${missing.label} is required.`);
    try {
      const body = coerce(fields, form);
      if (editing.id) await r.update(editing.id, body); else await r.create(body);
      setMessage(editing.id ? 'Changes saved.' : `${title.slice(0, -1)} added.`);
      setEditing(null); setError('');
    } catch (e) { setError(e.message); }
  };

  const remove = async (row) => {
    if (!confirmAction(`Delete ${row[columns[0].key]}? This cannot be undone.`)) return;
    try { await r.remove(row.id); setMessage('Deleted.'); setError(''); } catch (e) { setError(e.message); }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <H1>{title}</H1>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Field label="Search" value={r.search} onChangeText={r.setSearch} placeholder={`Search ${title.toLowerCase()}`} style={{ flexBasis: 220 }} />
          {canEdit && <Btn kind="primary" title={`Add ${title.slice(0, -1).toLowerCase()}`} onPress={() => open()} style={{ alignSelf: 'flex-end' }} />}
        </View>
      </View>

      <Banner>{error || r.error}</Banner>
      <Banner kind="ok">{message}</Banner>

      {editing && (
        <Card>
          <H2>{editing.id ? `Edit ${title.slice(0, -1).toLowerCase()}` : `Add ${title.slice(0, -1).toLowerCase()}`}</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {fields.map((f) =>
              f.type === 'select' || f.type === 'bool' ? (
                <Select
                  key={f.key}
                  label={f.label}
                  value={f.type === 'bool' ? String(form[f.key]) : form[f.key]}
                  onChange={(v) => setForm({ ...form, [f.key]: f.type === 'bool' ? v === 'true' : v })}
                  options={f.type === 'bool' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] : f.options}
                />
              ) : (
                <Field
                  key={f.key}
                  label={f.label + (f.required ? ' *' : '')}
                  value={String(form[f.key] ?? '')}
                  keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                  onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                />
              )
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn kind="primary" title="Save" onPress={save} />
            <Btn title="Cancel" onPress={() => setEditing(null)} />
          </View>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 720, flex: 1 }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head }}>
              {columns.map((c) => (
                <Pressable key={c.key} disabled={!c.sort} onPress={() => r.toggleSort(c.key)} style={{ flex: 1, padding: 14, minWidth: 120 }} accessibilityRole={c.sort ? 'button' : 'text'}>
                  <Text style={[FONT, { fontSize: 13, fontWeight: '600', color: C.ink }]}>
                    {c.label}{c.sort ? (r.sortBy.sort === c.key ? (r.sortBy.order === 'asc' ? ' ▲' : ' ▼') : ' ↕') : ''}
                  </Text>
                </Pressable>
              ))}
              {canEdit && <View style={{ width: 170, padding: 14 }}><Text style={[FONT, { fontSize: 13, fontWeight: '600' }]}>Actions</Text></View>}
            </View>
            {r.loading && <Muted style={{ padding: 16 }}>Loading…</Muted>}
            {!r.loading && r.data.length === 0 && (
              <Muted style={{ padding: 16 }}>
                {r.search ? 'No matches. Try a different search.' : `No ${title.toLowerCase()} yet.${canEdit ? ' Select “Add” to create the first one.' : ''}`}
              </Muted>
            )}
            {r.data.map((row) => (
              <View key={row.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' }}>
                {columns.map((c) => (
                  <Text key={c.key} style={[FONT, { flex: 1, minWidth: 120, padding: 14, fontSize: 14, color: C.ink }]}>{show(row[c.key])}</Text>
                ))}
                {canEdit && (
                  <View style={{ width: 170, padding: 8, flexDirection: 'row', gap: 8 }}>
                    <Btn small title="Edit" onPress={() => open(row)} />
                    <Btn small kind="danger" title="Delete" onPress={() => remove(row)} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>
    </View>
  );
}
