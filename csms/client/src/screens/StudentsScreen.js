import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { api } from '../lib/api'
import { useDebounce } from '../hooks/useDebounce'
import ImportPanel from '../components/ImportPanel'
import {
  Banner, Btn, Card, Field, H1, H2, Muted, Select, confirmAction,
} from '../components/ui'
import { C, FONT } from '../theme'

const PAGE = 50
const blank = { student_number: '', full_name: '', email: '', course: '', year_level: '', section_id: '' }
const day = (iso) => new Date(iso).toLocaleDateString()

// Admin: the official student roster. A student can only register against a row that exists here.
export default function StudentsScreen() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [linked, setLinked] = useState('')
  const [sort, setSort] = useState({ col: 'student_number', order: 'asc' })
  const [page, setPage] = useState(1)
  const [sections, setSections] = useState([])
  const [editing, setEditing] = useState(null) // null closed, {} new, row editing
  const [form, setForm] = useState(blank)
  const [importing, setImporting] = useState(false)
  const [codeInfo, setCodeInfo] = useState(null)
  const debounced = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        sort: sort.col, order: sort.order, search: debounced,
        page: String(page), pageSize: String(PAGE),
      })
      if (sectionId) qs.set('section_id', sectionId)
      if (linked) qs.set('linked', linked)
      const r = await api.get(`/api/students?${qs}`)
      setRows(r.data)
      setTotal(r.total ?? r.data.length)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sort, debounced, page, sectionId, linked])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debounced, sectionId, linked, sort])
  const loadSections = () =>
    api.get('/api/sections?pageSize=200').then((r) => setSections(r.data)).catch((e) => setError(e.message))
  useEffect(() => { loadSections() }, [])

  const toggleSort = (col) =>
    setSort((s) => ({ col, order: s.col === col && s.order === 'asc' ? 'desc' : 'asc' }))

  const open = (row) => {
    setEditing(row || {})
    setForm(row ? { ...blank, ...row, email: row.email || '', course: row.course || '', year_level: row.year_level ?? '', section_id: row.section_id || '' } : blank)
    setMessage('')
    setError('')
  }

  const save = async () => {
    if (!form.student_number.trim() || !form.full_name.trim())
      return setError('Student number and name are required.')
    const body = {
      student_number: form.student_number, full_name: form.full_name, email: form.email,
      course: form.course, year_level: form.year_level === '' ? null : Number(form.year_level),
      section_id: form.section_id || null,
    }
    try {
      if (editing.id) await api.put(`/api/students/${editing.id}`, body)
      else await api.post('/api/students', body)
      setMessage(editing.id ? 'Changes saved.' : 'Student added.')
      setEditing(null); setError(''); load()
    } catch (e) { setError(e.message) }
  }

  const act = async (fn, ok) => {
    try { await fn(); setMessage(ok); setError(''); load() } catch (e) { setError(e.message) }
  }
  const remove = (s) =>
    confirmAction(`Remove ${s.full_name} from the roster?${s.profile_id ? ' Their account will lose access to the schedule.' : ''}`) &&
    act(() => api.del(`/api/students/${s.id}`), 'Student removed.')
  const unlink = (s) =>
    confirmAction(`Unlink ${s.full_name}'s account? They lose access until they link again.`) &&
    act(() => api.post(`/api/students/${s.id}/unlink`), 'Account unlinked.')
  const issueCode = async (s) => {
    try {
      const { data } = await api.post(`/api/students/${s.id}/claim-code`)
      setCodeInfo({ name: s.full_name, number: s.student_number, ...data })
      setError(''); load()
    } catch (e) { setError(e.message) }
  }

  const cols = [
    { label: 'Student no.', key: 'student_number', w: 1.1 },
    { label: 'Name', key: 'full_name', w: 1.6 },
    { label: 'Course / year', key: 'course', w: 1.1 },
    { label: 'Section', w: 1 },
    { label: 'School email', w: 1.6 },
    { label: 'Account', w: 1 },
  ]
  const status = (s) =>
    s.profile_id ? 'Linked' : s.claim_code_expires_at ? `Code issued (to ${day(s.claim_code_expires_at)})` : 'Not linked'
  const last = Math.max(1, Math.ceil(total / PAGE))

  return (
    <View style={{ gap: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ gap: 6 }}>
          <H1>Students</H1>
          <Muted>The school roster. Students can only register against a record listed here.</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Btn title="Import roster (CSV)" onPress={() => setImporting((v) => !v)} />
          <Btn kind="primary" title="Add student" onPress={() => open()} />
        </View>
      </View>

      <Banner>{error}</Banner>
      <Banner kind="ok">{message}</Banner>

      {importing && (
        <ImportPanel
          entities={['students']}
          onClose={() => setImporting(false)}
          onDone={() => { load(); loadSections() }}
        />
      )}

      {codeInfo && (
        <Card style={{ gap: 8, borderColor: C.blue }}>
          <H2>Registration code for {codeInfo.name}</H2>
          <Text selectable style={[FONT, { fontSize: 30, fontWeight: '700', letterSpacing: 3, color: C.ink }]}>
            {codeInfo.code}
          </Text>
          <Muted>
            Student no. {codeInfo.number}. Valid until {day(codeInfo.expires_at)}. It is shown only now, so
            give it to the student before closing this. Five wrong tries lock it.
          </Muted>
          <Btn small title="Done" onPress={() => setCodeInfo(null)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      )}

      {editing && (
        <Card>
          <H2>{editing.id ? 'Edit student' : 'Add student'}</H2>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Field label="Student number *" value={form.student_number} onChangeText={(v) => setForm({ ...form, student_number: v })} autoCapitalize="characters" />
            <Field label="Full name *" value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
            <Field label="School email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Course" value={form.course} onChangeText={(v) => setForm({ ...form, course: v })} />
            <Field label="Year level" value={String(form.year_level)} onChangeText={(v) => setForm({ ...form, year_level: v })} keyboardType="numeric" />
            <Select
              label="Section"
              value={form.section_id}
              onChange={(v) => setForm({ ...form, section_id: v })}
              options={[{ value: '', label: 'No section' }, ...sections.map((x) => ({ value: x.id, label: x.section_name }))]}
            />
          </View>
          <Muted style={{ marginTop: 10 }}>
            Without a school email, the student needs a registration code from you. With one, they register with that email.
          </Muted>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn kind="primary" title="Save" onPress={save} />
            <Btn title="Cancel" onPress={() => setEditing(null)} />
          </View>
        </Card>
      )}

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Number, name or email" style={{ flexBasis: 220 }} />
        <Select label="Section" value={sectionId} onChange={setSectionId}
          options={[{ value: '', label: 'All sections' }, ...sections.map((x) => ({ value: x.id, label: x.section_name }))]} />
        <Select label="Account" value={linked} onChange={setLinked}
          options={[{ value: '', label: 'All' }, { value: 'yes', label: 'Linked' }, { value: 'no', label: 'Not linked' }]} />
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal>
          <View style={{ minWidth: 980, flex: 1 }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.head }}>
              {cols.map((c) => (
                <Pressable key={c.label} disabled={!c.key} onPress={() => toggleSort(c.key)} style={{ flex: c.w, padding: 14 }} accessibilityRole={c.key ? 'button' : 'text'}>
                  <Text style={[FONT, { fontSize: 13, fontWeight: '600', color: C.ink }]}>
                    {c.label}{c.key ? (sort.col === c.key ? (sort.order === 'asc' ? ' ▲' : ' ▼') : ' ↕') : ''}
                  </Text>
                </Pressable>
              ))}
              <View style={{ width: 300, padding: 14 }}>
                <Text style={[FONT, { fontSize: 13, fontWeight: '600' }]}>Actions</Text>
              </View>
            </View>
            {loading && <Muted style={{ padding: 16 }}>Loading…</Muted>}
            {!loading && rows.length === 0 && (
              <Muted style={{ padding: 16 }}>
                {debounced || sectionId || linked ? 'No matches.' : 'No students yet. Import the roster file or add a student.'}
              </Muted>
            )}
            {rows.map((s) => {
              const cells = [
                s.student_number, s.full_name,
                [s.course, s.year_level ? `Year ${s.year_level}` : ''].filter(Boolean).join(' · '),
                s.section?.section_name, s.email || '—', status(s),
              ]
              return (
                <View key={s.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, alignItems: 'center' }}>
                  {cells.map((v, i) => (
                    <Text key={i} style={[FONT, { flex: cols[i].w, padding: 14, fontSize: 14, color: i === 5 && s.profile_id ? C.ok : C.ink }]}>{v}</Text>
                  ))}
                  <View style={{ width: 300, padding: 8, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Btn small title="Edit" onPress={() => open(s)} />
                    {!s.profile_id && !s.email && (
                      <Btn small title={s.claim_code_expires_at ? 'New code' : 'Issue code'} onPress={() => issueCode(s)} />
                    )}
                    {!!s.profile_id && <Btn small title="Unlink" onPress={() => unlink(s)} />}
                    <Btn small kind="danger" title="Delete" onPress={() => remove(s)} />
                  </View>
                </View>
              )
            })}
          </View>
        </ScrollView>
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Btn small title="Previous" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
        <Muted>Page {page} of {last} · {total} student{total === 1 ? '' : 's'}</Muted>
        <Btn small title="Next" disabled={page >= last} onPress={() => setPage((p) => p + 1)} />
      </View>
    </View>
  )
}
