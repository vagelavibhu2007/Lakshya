import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTeamUsers, createTeamUser, updateTeamUser, deleteTeamUser, hardDeleteTeamUser } from '../../api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const ROLES = ['member', 'campus_ambassador', 'teamleader']
const ROLE_LABELS = { member: 'Member', campus_ambassador: 'Campus Ambassador', teamleader: 'Team Leader' }
const ROLE_BADGE = { member: 'badge-gray', campus_ambassador: 'bg-pink-500/20 text-pink-400 badge', teamleader: 'badge-warning' }

// Fix 2: Password strength component (same as Admin)
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
    const { user } = useAuth()
    const [form, setForm] = useState(initial || { name: '', email: '', password: '', role: 'member' })
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))

    const isCAMismatch = form.role === 'campus_ambassador' && !['marketing', 'online marketing'].includes(user?.teamId?.name?.toLowerCase())

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Name</label><input className="input" value={form.name} onChange={f('name')} required /></div>
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
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={f('role')}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
            </div>
            {isCAMismatch && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    ⚠️ Campus Ambassadors can only be assigned to the <strong>Marketing</strong> or <strong>Online Marketing</strong> team. Your team is "{user?.teamId?.name}". Please change the role.
                </div>
            )}
            {initial && (
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="isActive" checked={form.isActive !== false} onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
                    <label htmlFor="isActive" className="text-sm text-gray-300">Active member</label>
                </div>
            )}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || isCAMismatch}>
                {loading ? '⏳ Saving...' : (initial ? '💾 Update Member' : '➕ Add Member')}
            </button>
        </form>
    )
}

export default function TeamMembers() {
    const qc = useQueryClient()
    const { user } = useAuth()
    const [modal, setModal] = useState(null)
    const [search, setSearch] = useState('')

    const isCAAllowedTeam = ['Marketing', 'Online Marketing'].includes(user?.teamId?.name)

    const { data, isLoading } = useQuery({
        queryKey: ['team-users', user?.teamId?._id],
        queryFn: () => getTeamUsers(user?.teamId?._id),
        enabled: !!user?.teamId?._id
    })

    let users = data?.data?.users || []
    if (search) {
        users = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    }

    const teamLeaders = users.filter(u => u.role === 'teamleader')
    const members = users.filter(u => u.role !== 'teamleader')
    const sortedUsers = [...teamLeaders, ...members]

    const createMut = useMutation({ mutationFn: (d) => createTeamUser(user.teamId._id, d), onSuccess: () => { qc.invalidateQueries(['team-users']); setModal(null); toast.success('Member added!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const updateMut = useMutation({ mutationFn: ({ id, ...d }) => updateTeamUser(user.teamId._id, id, d), onSuccess: () => { qc.invalidateQueries(['team-users']); setModal(null); toast.success('Member updated!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deactivateMut = useMutation({ mutationFn: (id) => deleteTeamUser(user.teamId._id, id), onSuccess: () => { qc.invalidateQueries(['team-users']); toast.success('Member deactivated') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const hardDeleteMut = useMutation({ mutationFn: (id) => hardDeleteTeamUser(user.teamId._id, id), onSuccess: () => { qc.invalidateQueries(['team-users']); toast.success('Member permanently deleted') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="page-title mb-0 text-xl sm:text-2xl">👥 Team Members</h1>
                <button onClick={() => setModal({ type: 'create' })} className="btn-primary w-full sm:w-auto justify-center">➕ Add Member</button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <input className="input max-w-full sm:max-w-xs" placeholder="Search team members..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="table-wrapper">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                {isCAAllowedTeam && <th>Referral Code</th>}
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedUsers.map((u) => (
                                <tr key={u._id} className={u.role === 'teamleader' ? 'bg-primary-500/5' : ''}>
                                    <td className="font-medium text-white">
                                        {u.name} {u._id === user._id && <span className="text-xs text-primary-400 ml-2">(You)</span>}
                                    </td>
                                    <td className="text-gray-400">{u.email}</td>
                                    <td>
                                        <span className={u.role === 'teamleader' ? 'badge-warning' : (ROLE_BADGE[u.role] || 'badge-gray')}>
                                            {u.role === 'teamleader' ? 'Team Leader' : (ROLE_LABELS[u.role] || u.role)}
                                        </span>
                                    </td>
                                    {isCAAllowedTeam && (
                                        <td className="text-gray-300">
                                            {u.role === 'campus_ambassador' ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs">
                                                        {u.referralCode || '—'}
                                                    </span>
                                                    {u.referralCode && (
                                                        <button
                                                            type="button"
                                                            className="btn-secondary py-1 px-2 text-xs"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(u.referralCode)
                                                                toast.success('Referral code copied')
                                                            }}
                                                        >
                                                            Copy
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">—</span>
                                            )}
                                        </td>
                                    )}
                                    <td><span className={u.isActive ? 'badge-success' : 'badge-danger'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                                    <td>
                                        <div className="flex gap-1.5">
                                            {u.role !== 'teamleader' && (
                                                <>
                                                    <button onClick={() => setModal({ type: 'edit', user: u })} className="btn-secondary py-1 px-2 text-xs">✏️ Edit</button>
                                                    <button onClick={() => { if (window.confirm(`Deactivate ${u.name}? They stay in DB but become inactive.`)) deactivateMut.mutate(u._id) }} className="btn-secondary py-1 px-2 text-xs text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10">⏸️</button>
                                                    <button onClick={() => { if (window.confirm(`⚠️ PERMANENTLY DELETE ${u.name}? This cannot be undone!`)) hardDeleteMut.mutate(u._id) }} className="btn-danger py-1 px-2 text-xs">🗑️</button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sortedUsers.length === 0 && <tr><td colSpan={isCAAllowedTeam ? 6 : 5} className="text-center text-gray-500 py-8">No members found</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create modal */}
            <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Add Team Member">
                <UserForm onSubmit={(data) => createMut.mutate(data)} loading={createMut.isPending} />
            </Modal>

            {/* Edit modal */}
            <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit Member">
                {modal?.user && (
                    <UserForm
                        initial={modal.user}
                        onSubmit={(data) => updateMut.mutate({ id: modal.user._id, ...data })}
                        loading={updateMut.isPending}
                    />
                )}
            </Modal>
        </div>
    )
}