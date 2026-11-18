import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { api } from '../lib/api';
import { parseCsv } from '../lib/csv';
import { Banner, Btn, Card, H2, Muted, Select } from './ui';
import { C, FONT } from '../theme';

const COLUMNS = {
  subjects: 'code, name, description, units, type, department',
  instructors: 'name, email, department, employment_type, max_load_hours',
  rooms: 'name, building, capacity, type, is_available',
};

// Admin: add many subjects, instructors or rooms from a CSV file.
export default function ImportPanel({ onClose, onDone }) {
  const [entity, setEntity] = useState('subjects');
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const choose = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setResult(null); setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result);
      setRows(parsed);
      if (!parsed.length) setError('No rows found. The first row must be the column names, followed by at least one row of data.');
    };
    reader.onerror = () => setError('That file could not be read. Try saving it as CSV again.');
    reader.readAsText(file);
  };

  const run = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post(`/api/import/${entity}`, { rows });
      setResult(r); setRows([]); setFileName('');
      onDone?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <Card style={{ gap: 14 }}>
      <H2>Import from CSV</H2>
      <Select label="Import into" value={entity} onChange={(v) => { setEntity(v); setRows([]); setResult(null); setError(''); }}
        options={[{ value: 'subjects', label: 'Subjects' }, { value: 'instructors', label: 'Instructors' }, { value: 'rooms', label: 'Rooms' }]}
        style={{ flexGrow: 0, flexBasis: 220, maxWidth: 260 }} />
      <Muted>The first row of the file must be these column names: {COLUMNS[entity]}. Leave a cell blank to use the default.</Muted>
      {Platform.OS === 'web' && React.createElement('input', {
        type: 'file', accept: '.csv,text/csv', onChange: choose, 'aria-label': 'Choose a CSV file',
        style: { fontFamily: 'inherit', fontSize: 14 },
      })}
      <Banner>{error}</Banner>
      {rows.length > 0 && <Muted>{fileName}: {rows.length} row{rows.length === 1 ? '' : 's'} ready to import.</Muted>}
      {result && (
        <View style={{ gap: 6 }}>
          <Banner kind="ok">{result.inserted} added.{result.errors.length ? ` ${result.errors.length} could not be added.` : ''}</Banner>
          {result.errors.slice(0, 10).map((e, i) => (
            <Text key={i} style={[FONT, { fontSize: 14, color: C.danger }]}>Row {e.row}: {e.message}</Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn kind="primary" title={busy ? 'Importing…' : 'Import'} onPress={run} disabled={busy || rows.length === 0} />
        <Btn title="Close" onPress={onClose} />
      </View>
    </Card>
  );
}
