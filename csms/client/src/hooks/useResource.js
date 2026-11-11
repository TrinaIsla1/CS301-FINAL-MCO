import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useDebounce } from './useDebounce';

// List + create/update/delete for one API resource, with sort and debounced search.
export function useResource(path, { sort = 'created_at', order = 'asc', query = '' } = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const [sortBy, setSortBy] = useState({ sort, order });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const qs = new URLSearchParams({ sort: sortBy.sort, order: sortBy.order, search: debounced, pageSize: '200' });
      const { data } = await api.get(`${path}?${qs}${query ? `&${query}` : ''}`);
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [path, query, sortBy, debounced]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (col) =>
    setSortBy((s) => ({ sort: col, order: s.sort === col && s.order === 'asc' ? 'desc' : 'asc' }));

  return {
    ...state,
    search, setSearch, sortBy, toggleSort, reload: load,
    create: async (body) => { const r = await api.post(path, body); await load(); return r.data; },
    update: async (id, body) => { const r = await api.put(`${path}/${id}`, body); await load(); return r.data; },
    remove: async (id) => { await api.del(`${path}/${id}`); await load(); },
  };
}
