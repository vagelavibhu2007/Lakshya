import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser, hardDeleteUser } from '../../api'
import { getTeams } from '../../api'
import toast from 'react-hot-toast'

const ROLES = ['admin', 'teamleader', 'faculty', 'member', 'campus_ambassador']
const ROLE_LABELS = { admin: 'Admin', teamleader: 'Team Leader', faculty: 'Faculty', member: 'Member', campus_ambassador: 'Campus Ambassador' }
const ROLE_BADGE = { admin: 'badge-primary', teamleader: 'badge-warning', faculty: 'badge-success', member: 'badge-gray', campus_ambassador: 'bg-pink-500/20 text-pink-400 badge' }

function PasswordStrength({ password }) {
    const checks = [
        { label: '8+', pass: password.length >= 8 },
        { label: 'A-Z', pass: /[A-Z]/.test(password) },
        { label: 'a-z', pass: /[a-z]/.test(password) },
        { label: '0-9', pass: /\d/.test(password) },
        { label: '@#$', pass: /[@$!%*?&#^()_+=\-~`|{}[\]:;"'<>,./\\]/.test(password) },
    ]
    const score = checks.filter(c => c.pass).length
    const color = score <= 2 ? 'bg-red-500' : score <= 4 ? 'bg-yellow-500' : 'bg-emerald-500'
    if (!password) return null
    return (
        <div className="mt-1.5 space-y-1">
            <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i <= score ? color : 'bg-dark-500'}`} />)}</div>
            <div className="flex gap-1.5 flex-wrap">{checks.map(c => <span key={c.label} className={`text-[10px] ${c.pass ? 'text-emerald-400' : 'text-gray-500'}`}>{c.pass ? '✓' : '○'}{c.label}</span>)}</div>
        </div>
    )
}

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-dark-500">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}

function UserForm({ initial, onSubmit, loading }) {
    const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamsData?.data?.teams || []
    const [form, setForm] = useState(initial || { name: '', email: '', password: '', role: 'member', teamId: '', secondaryTeamIds: [], phone: '' })
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))

    const nameHasNumbers = /\d/.test(form.name)
    const phoneInvalid = form.phone && !/^\d{10}$/.test(form.phone)
    
    const allSelectedTeamIds = [form.teamId, ...(form.secondaryTeamIds || [])].filter(Boolean)
    const selectedTeams = teams.filter(t => allSelectedTeamIds.includes(t._id))
    
    // CA can only be in Marketing or Online Marketing (in any of their teams)
    const isCAMismatch = form.role === 'campus_ambassador' && (
        allSelectedTeamIds.length === 0 || 
        selectedTeams.some(t => !['marketing', 'online marketing'].includes(t.name.toLowerCase()))
    )

    const addTeamSlot = () => setForm(s => ({ ...s, secondaryTeamIds: [...(s.secondaryTeamIds || []), ''] }))
    const updateTeamSlot = (index, value) => {
        if (index === 0) {
            setForm(s => ({ ...s, teamId: value }))
        } else {
            const next = [...(form.secondaryTeamIds || [])]
            if (value === '') {
                next.splice(index - 1, 1)
            } else {
                next[index - 1] = value
            }
            setForm(s => ({ ...s, secondaryTeamIds: next }))
        }
    }

    const teamSlots = [form.teamId, ...(form.secondaryTeamIds || [])]

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, secondaryTeamIds: (form.secondaryTeamIds || []).filter(Boolean) }) }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="label">Name</label>
                    <input className="input" value={form.name} onChange={f('name')} required minLength={2} />
                    {nameHasNumbers && <p className="text-xs text-red-400 mt-1">Name must not contain numbers</p>}
                </div>
                <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={f('email')} required={!initial} /></div>
            </div>
            {!initial && (
                <div>
                    <label className="label">Password</label>
                    <input type="password" className="input" value={form.password} onChange={f('password')} required minLength={8} />
                    <PasswordStrength password={form.password || ''} />
                </div>
            )}
            <div>
                <label className="label">Phone</label>
                <input type="tel" className="input" value={form.phone || ''} onChange={f('phone')} placeholder="10-digit number" maxLength={10} />
                {phoneInvalid && <p className="text-xs text-red-400 mt-1">Phone must be exactly 10 digits</p>}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                    <label className="label">Role</label>
                    <select className="input" value={form.role} onChange={f('role')}>
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                </div>

                {teamSlots.map((slotId, idx) => (
                    <div key={idx}>
                        <label className="label">Team {idx + 1} {idx === 0 ? '(Primary)' : ''}</label>
                        <select 
                            className="input" 
                            value={slotId || ''} 
                            onChange={(e) => updateTeamSlot(idx, e.target.value)}
                            required={idx === 0}
                        >
                            <option value="">{idx === 0 ? 'No team' : '🗑️ Remove team slot'}</option>
                            {teams.map((t) => (
                                <option 
                                    key={t._id} 
                                    value={t._id} 
                                    disabled={allSelectedTeamIds.includes(t._id) && slotId !== t._id}
                                >
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {teamSlots.length < teams.length && (
                <button type="button" onClick={addTeamSlot} className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1">
                    ➕ Add another team
                </button>
            )}

            {isCAMismatch && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    ⚠️ Campus Ambassadors can only be assigned to <strong>Marketing</strong> or <strong>Online Marketing</strong> teams. Please check all selected teams.
                </div>
            )}
            {initial && (
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="isActive" checked={form.isActive !== false} onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
                    <label htmlFor="isActive" className="text-sm text-gray-300">Active user</label>
                </div>
            )}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || nameHasNumbers || phoneInvalid || isCAMismatch}>
                {loading ? '⏳ Saving...' : (initial ? '💾 Update User' : '➕ Create User')}
            </button>
        </form>
    )
}

export default function AdminUsers() {
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const [filters, setFilters] = useState({ search: '', role: 'all' })
    const [page, setPage] = useState(1)

    const { data, isLoading } = useQuery({
        queryKey: ['admin-users', filters.search, filters.role, page],
        queryFn: () => getUsers({
            search: filters.search,
            role: filters.role === 'all' ? undefined : filters.role,
            page,
            limit: 15
        }),
    })
    const users = data?.data?.users || []
    const total = data?.data?.total || 0
    const pages = data?.data?.pages || 1

    const createMut = useMutation({ mutationFn: createUser, onSuccess: () => { qc.invalidateQueries(['admin-users']); setModal(null); toast.success('User created!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const updateMut = useMutation({ mutationFn: ({ id, ...d }) => updateUser(id, d), onSuccess: () => { qc.invalidateQueries(['admin-users']); setModal(null); toast.success('User updated!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deactivateMut = useMutation({ mutationFn: deleteUser, onSuccess: () => { qc.invalidateQueries(['admin-users']); toast.success('User deactivated') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const hardDeleteMut = useMutation({ mutationFn: hardDeleteUser, onSuccess: () => { qc.invalidateQueries(['admin-users']); toast.success('User permanently deleted') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="page-title mb-0 text-xl sm:text-2xl">👥 Users ({total})</h1>
                <button onClick={() => setModal({ type: 'create' })} className="btn-primary w-full sm:w-auto justify-center">➕ Add User</button>
            </div>

            {/* Role Tabs */}
            <div className="flex gap-4 border-b border-dark-500 mb-5 overflow-x-auto pb-1">
                {['all', 'admin', 'teamleader', 'faculty', 'member', 'campus_ambassador'].map(r => (
                    <button key={r} onClick={() => { setFilters(f => ({ ...f, role: r })); setPage(1); }}
                        className={`pb-2 px-2 border-b-2 font-medium capitalize whitespace-nowrap transition-colors ${filters.role === r ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                        {r === 'all' ? 'All Users' : ROLE_LABELS[r]}
                    </button>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <input className="input w-full sm:max-w-xs" placeholder="Search by name or email..." value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <>
                    {/* Desktop Table View */}
                    <div className="table-wrapper hidden lg:block">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th className="whitespace-nowrap">Name</th>
                                    <th className="whitespace-nowrap">Email</th>
                                    <th className="whitespace-nowrap">Phone</th>
                                    <th className="whitespace-nowrap">Role</th>
                                    <th className="whitespace-nowrap">Team(s)</th>
                                    <th className="whitespace-nowrap">Status</th>
                                    <th className="whitespace-nowrap text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u._id}>
                                        <td className="whitespace-nowrap font-medium text-white">{u.name}</td>
                                        <td className="max-w-[180px] break-all text-gray-400">{u.email}</td>
                                        <td className="whitespace-nowrap text-gray-400 font-mono text-xs">{u.phone || '—'}</td>
                                        <td className="whitespace-nowrap">
                                            <span className={`${ROLE_BADGE[u.role] || 'badge-gray'} text-[10px]`}>
                                                {ROLE_LABELS[u.role] || u.role}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {u.teamId?.name && (
                                                    <span className="badge-gray text-[10px] py-0 px-1.5 border border-dark-400">
                                                        {u.teamId.name}
                                                    </span>
                                                )}
                                                {u.secondaryTeamIds?.map(t => (
                                                    <span key={t._id} className="badge bg-dark-600 text-primary-400 text-[10px] py-0 px-1.5 border border-primary-500/20">
                                                        {t.name}
                                                    </span>
                                                ))}
                                                {u.role === 'teamleader' && u.managedTeams?.map(t => (
                                                    t._id !== u.teamId?._id && !u.secondaryTeamIds?.some(st => st._id === t._id) && (
                                                        <span key={t._id} className="badge bg-dark-600 text-gray-400 text-[10px] py-0 px-1.5 border border-dark-500">
                                                            {t.name} (Lead)
                                                        </span>
                                                    )
                                                ))}
                                                {!u.teamId?.name && (!u.secondaryTeamIds || u.secondaryTeamIds.length === 0) && (!u.managedTeams || u.managedTeams.length === 0) && <span className="text-gray-500">—</span>}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <span className={u.isActive ? 'badge-success text-[10px]' : 'badge-danger text-[10px]'}>
                                                {u.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button 
                                                    onClick={() => setModal({ type: 'edit', user: u })} 
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-600 border border-dark-400 text-gray-400 hover:text-white hover:border-primary-500/50 transition-all"
                                                    title="Edit User"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    onClick={() => { if (window.confirm(`Deactivate ${u.name}?`)) deactivateMut.mutate(u._id) }} 
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/70 hover:text-yellow-400 hover:bg-yellow-500/20 transition-all"
                                                    title="Deactivate"
                                                >
                                                    ⏸️
                                                </button>
                                                <button 
                                                    onClick={() => { if (window.confirm(`⚠️ PERMANENTLY DELETE ${u.name}?`)) hardDeleteMut.mutate(u._id) }} 
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500/70 hover:text-red-400 hover:bg-red-500/20 transition-all"
                                                    title="Delete Permanently"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-8">No users found</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                        {users.map((u) => (
                            <div key={u._id} className="card flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-white text-base">{u.name}</h3>
                                        <p className="text-xs text-gray-400 break-all">{u.email}</p>
                                        {u.phone && <p className="text-xs text-gray-400 font-mono mt-0.5">📞 {u.phone}</p>}
                                    </div>
                                    <span className={u.isActive ? 'badge-success text-[10px]' : 'badge-danger text-[10px]'}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className={`${ROLE_BADGE[u.role] || 'badge-gray'} text-[10px]`}>
                                        {ROLE_LABELS[u.role] || u.role}
                                    </span>
                                    {u.teamId?.name && (
                                        <span className="badge-gray text-[10px] py-0 px-1.5 border border-dark-400">
                                            {u.teamId.name}
                                        </span>
                                    )}
                                    {u.secondaryTeamIds?.map(t => (
                                        <span key={t._id} className="badge bg-dark-600 text-primary-400 text-[10px] py-0 px-1.5 border border-primary-500/20">
                                            {t.name}
                                        </span>
                                    ))}
                                    {u.role === 'teamleader' && u.managedTeams?.map(t => (
                                        t._id !== u.teamId?._id && !u.secondaryTeamIds?.some(st => st._id === t._id) && (
                                            <span key={t._id} className="badge bg-dark-600 text-gray-400 text-[10px] py-0 px-1.5 border border-dark-500">
                                                {t.name} (Lead)
                                            </span>
                                        )
                                    ))}
                                </div>
                                <div className="flex gap-2 pt-3 border-t border-dark-500 mt-auto justify-end">
                                    <button 
                                        onClick={() => setModal({ type: 'edit', user: u })} 
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-dark-600 border border-dark-400 text-gray-400 hover:text-white hover:border-primary-500/50 transition-all"
                                        title="Edit User"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        onClick={() => { if (window.confirm(`Deactivate ${u.name}?`)) deactivateMut.mutate(u._id) }} 
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/70 hover:text-yellow-400 hover:bg-yellow-500/20 transition-all"
                                        title="Deactivate"
                                    >
                                        ⏸️
                                    </button>
                                    <button 
                                        onClick={() => { if (window.confirm(`⚠️ PERMANENTLY DELETE ${u.name}?`)) hardDeleteMut.mutate(u._id) }} 
                                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500/70 hover:text-red-400 hover:bg-red-500/20 transition-all"
                                        title="Delete Permanently"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && <div className="col-span-1 sm:col-span-2 text-center text-gray-500 py-8 card">No users found</div>}
                    </div>
                </>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center gap-2 justify-center">
                    <button className="btn-secondary py-1 px-3" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                    <span className="text-gray-400 text-sm">Page {page} of {pages}</span>
                    <button className="btn-secondary py-1 px-3" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>›</button>
                </div>
            )}

            {/* Create modal */}
            <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Create New User">
                <UserForm onSubmit={(data) => createMut.mutate(data)} loading={createMut.isPending} />
            </Modal>

            {/* Edit modal */}
            <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit User">
                {modal?.user && (
                    <UserForm
                        initial={{ ...modal.user, teamId: modal.user.teamId?._id || '', secondaryTeamIds: modal.user.secondaryTeamIds?.map(t => t._id || t) || [] }}
                        onSubmit={(data) => {
                            const { name, role, teamId, secondaryTeamIds, isActive, phone } = data;
                            updateMut.mutate({ id: modal.user._id, name, role, teamId, secondaryTeamIds, isActive, phone });
                        }}
                        loading={updateMut.isPending}
                    />
                )}
            </Modal>
        </div>
    )
}