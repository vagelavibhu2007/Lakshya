import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getResources, createResource, uploadResource, deleteResource, getTeams } from '../../api'
import toast from 'react-hot-toast'

const TYPE_ICON = { file: '📄', link: '🔗', text: '📝' }
const TYPE_BADGE = { file: 'badge-primary', link: 'badge-success', text: 'badge-warning' }
const CATEGORY_BADGE = (c) => c === 'all' ? 'badge-gray' : c === 'private' ? 'bg-red-500/20 text-red-400 badge' : 'bg-cyan-500/20 text-cyan-400 badge';
const CATEGORY_ICON = (c) => c === 'all' ? '📂' : c === 'private' ? '🔒' : '📁';

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

function AccessCodeModal({ open, onClose, onSubmit }) {
    const [code, setCode] = useState('')
    
    useEffect(() => {
        if (open) setCode('');
    }, [open])

    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(code) }} className="p-5 space-y-4">
            <div className="text-center">
                <span className="text-4xl">🔒</span>
                <h3 className="text-lg font-bold text-white mt-2">Private Resource</h3>
                <p className="text-sm text-gray-400 mt-1">Enter the access code to view this resource</p>
            </div>
            <input className="input text-center font-mono text-lg tracking-widest" placeholder="Enter code..." value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">🔓 Unlock</button>
            </div>
        </form>
    </div></div>
}

function ResourceForm({ onSubmit, loading }) {
    const { data } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = data?.data?.teams || []
    const [type, setType] = useState('link')
    const [form, setForm] = useState({
        title: '', description: '', tags: '', value: '',
        scope: 'global', teamId: '', targetRoles: [],
        isCAResource: false, category: 'all', accessCode: ''
    })
    const [file, setFile] = useState(null)
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target.value : v }))

    const handleSubmit = (e) => {
        e.preventDefault()
        if (type === 'file' && file) {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('title', form.title)
            fd.append('description', form.description)
            fd.append('tags', JSON.stringify(form.tags.split(',').map((t) => t.trim()).filter(Boolean)))
            fd.append('scope', form.scope)
            fd.append('isCAResource', form.isCAResource)
            fd.append('category', form.category)
            if (form.category === 'private') fd.append('accessCode', form.accessCode)
            if (form.scope === 'team' && form.teamId) fd.append('teamId', form.teamId)
            if (form.scope === 'role' && form.targetRoles.length > 0) fd.append('targetRoles', JSON.stringify(form.targetRoles))
            onSubmit({ type: 'upload', data: fd })
        } else {
            const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
            const payload = { ...form, tags, type }
            if (form.scope !== 'team') delete payload.teamId
            if (form.scope !== 'role') delete payload.targetRoles
            if (form.category !== 'private') delete payload.accessCode
            onSubmit({ type, data: payload })
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="label">Resource Type</label>
                <div className="flex gap-2">
                    {['file', 'link', 'text'].map((t) => (
                        <button key={t} type="button" onClick={() => setType(t)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${type === t ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-400 text-gray-400'}`}>
                            {TYPE_ICON[t]} {t}
                        </button>
                    ))}
                </div>
            </div>
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={f('title')} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={f('description')} /></div>
            <div><label className="label">Tags (comma-separated)</label><input className="input" value={form.tags} onChange={f('tags')} placeholder="design, template, official" /></div>

            {type === 'file' ? (
                <div><label className="label">File (PDF/DOC/Image, max 10MB)</label><input type="file" className="input py-2" onChange={(e) => setFile(e.target.files[0])} accept=".pdf,.csv,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt" required /></div>
            ) : (
                <div><label className="label">{type === 'link' ? 'URL *' : 'Text Content *'}</label>
                    {type === 'link' ? <input className="input" type="url" value={form.value} onChange={f('value')} placeholder="https://..." required /> : <textarea className="input font-mono text-sm" rows={4} value={form.value} onChange={f('value')} required />}
                </div>
            )}

            {/* Category */}
            <div>
                <label className="label">Category</label>
                <div className="flex gap-2 flex-wrap">
                    {['all', ...teams.map(t => t.name.toLowerCase()), 'private'].map((c) => (
                        <button key={c} type="button" onClick={() => setForm(s => ({ ...s, category: c }))}
                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.category === c ? 'bg-primary-500 border-primary-500 text-white' : 'bg-dark-700 border-dark-400 text-gray-400'}`}>
                            {CATEGORY_ICON(c)} {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Access Code for Private */}
            {form.category === 'private' && (
                <div>
                    <label className="label">🔒 Access Code *</label>
                    <input className="input font-mono" value={form.accessCode} onChange={f('accessCode')} placeholder="Enter a secret code..." required />
                    <p className="text-xs text-gray-500 mt-1">Users must enter this code to access this resource</p>
                </div>
            )}

            {/* CA checkbox */}
            <div className="p-3 rounded-lg bg-dark-700 border border-dark-500">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.isCAResource}
                        onChange={(e) => setForm((s) => ({ ...s, isCAResource: e.target.checked }))}
                        className="w-5 h-5 rounded accent-pink-500"
                    />
                    <div>
                        <span className="text-sm font-medium text-white">Can CA view?</span>
                        <p className="text-xs text-gray-400 mt-0.5">If checked, Campus Ambassadors will be able to see this resource</p>
                    </div>
                </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Scope</label>
                    <select className="input" value={form.scope} onChange={f('scope')}>
                        <option value="global">🌐 Global</option>
                        <option value="team">🏷️ Team</option>
                        <option value="role">👥 Role</option>
                    </select>
                </div>
                {form.scope === 'team' && (
                    <div><label className="label">Team</label>
                        <select className="input" value={form.teamId} onChange={f('teamId')}>
                            <option value="">Select team</option>
                            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                    </div>
                )}
                {form.scope === 'role' && (
                    <div><label className="label">Target Roles</label>
                        <select multiple className="input h-20" value={form.targetRoles} onChange={(e) => setForm(s => ({ ...s, targetRoles: Array.from(e.target.selectedOptions, o => o.value) }))}>
                            <option value="member">Member</option>
                            <option value="campus_ambassador">Campus Ambassador</option>
                            <option value="teamleader">Team Leader</option>
                            <option value="faculty">Faculty</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                )}
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>{loading ? '⏳ Uploading...' : '📤 Add Resource'}</button>
        </form>
    )
}

export default function AdminResources() {
    const qc = useQueryClient()
    const [modal, setModal] = useState(false)
    const [filters, setFilters] = useState({ type: '', search: '', scope: 'all', category: 'all', isCAResource: false })
    const [page, setPage] = useState(1)
    const [accessModal, setAccessModal] = useState(null) // resource needing code

    const { user } = useAuth()
    const { data: teamData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamData?.data?.teams || []

    const { data, isLoading } = useQuery({
        queryKey: ['resources', user?._id, filters, page],
        queryFn: () => getResources({
            ...filters,
            isCAResource: filters.isCAResource ? 'true' : undefined,
            page, limit: 12
        }),
        enabled: !!user?._id
    })
    const resources = data?.data?.resources || []
    const total = data?.data?.total || 0

    const createMut = useMutation({
        mutationFn: ({ type, data: d }) => type === 'upload' ? uploadResource(d) : createResource(d),
        onSuccess: () => { qc.invalidateQueries(['resources']); setModal(false); toast.success('Resource added!') },
        onError: (e) => toast.error(e.response?.data?.message || 'Error'),
    })
    const deleteMut = useMutation({ mutationFn: deleteResource, onSuccess: () => { qc.invalidateQueries(['resources']); toast.success('Deleted') } })

    const handleResourceClick = (resource) => {
        if (resource.category === 'private' && resource.accessCode) {
            setAccessModal(resource)
        } else {
            openResource(resource)
        }
    }

    const handleAccessCode = (code) => {
        if (accessModal && code === accessModal.accessCode) {
            openResource(accessModal)
            setAccessModal(null)
        } else {
            toast.error('Invalid access code!')
        }
    }

    const openResource = (resource) => {
        if (resource.type === 'link' || resource.type === 'file') {
            window.open(resource.value, '_blank')
        } else {
            alert(resource.value)
        }
    }

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="page-title mb-0">📁 Resources ({total})</h1>
                <button onClick={() => setModal(true)} className="btn-primary">➕ Add Resource</button>
            </div>

            {/* Scope Tabs */}
            <div className="flex gap-4 border-b border-dark-500 mb-2 overflow-x-auto pb-1">
                {['all', 'global', 'team', 'role'].map(s => (
                    <button key={s} onClick={() => { setFilters(f => ({ ...f, scope: s })); setPage(1); }}
                        className={`pb-2 px-1 border-b-2 font-medium capitalize transition-colors whitespace-nowrap ${filters.scope === s ? 'border-primary-500 text-primary-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
                        {s} Resources
                    </button>
                ))}
            </div>

            {/* Category Tabs */}
            <div className="flex gap-3 flex-wrap items-center">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Category:</span>
                {['all', ...teams.map(t => t.name.toLowerCase()), 'private'].map(c => (
                    <button key={c} onClick={() => { setFilters(f => ({ ...f, category: c })); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filters.category === c ? 'bg-primary-500 text-white' : 'bg-dark-700 text-gray-400 hover:text-white'}`}>
                        {CATEGORY_ICON(c)} {c}
                    </button>
                ))}
                <div className="w-full sm:w-auto sm:ml-auto">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={filters.isCAResource} onChange={(e) => { setFilters(f => ({ ...f, isCAResource: e.target.checked })); setPage(1); }} className="accent-pink-500" />
                        <span className="text-gray-300">🎓 CA Only</span>
                    </label>
                </div>
            </div>

            <div className="flex gap-3 flex-wrap">
                <input className="input w-full sm:max-w-xs" placeholder="🔍 Search title/tags..." value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
                <select className="input w-full sm:w-36" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
                    <option value="">All Types</option>
                    {['file', 'link', 'text'].map((t) => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                </select>
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resources.map((r) => (
                        <div key={r._id} className="card-hover flex flex-col">
                            <div className="flex items-start gap-3 mb-2">
                                <span className="text-2xl">{TYPE_ICON[r.type]}</span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white truncate">{r.title}</h3>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <span className={`badge ${TYPE_BADGE[r.type]} text-xs`}>{r.type}</span>
                                        {r.category && r.category !== 'all' && <span className={`${CATEGORY_BADGE(r.category)} text-xs`}>{CATEGORY_ICON(r.category)} {r.category}</span>}
                                        {r.isCAResource && <span className="badge bg-pink-500/20 text-pink-400 text-xs">🎓 CA</span>}
                                        {r.teamId && <span className="badge-gray text-xs">{r.teamId.name}</span>}
                                    </div>
                                </div>
                            </div>
                            {r.description && <p className="text-sm text-gray-400 mb-2 line-clamp-2">{r.description}</p>}
                            {r.tags?.length > 0 && <div className="flex flex-wrap gap-1 mb-2">{r.tags.map((tag) => <span key={tag} className="badge-gray text-xs">#{tag}</span>)}</div>}
                            <div className="flex gap-2 mt-auto pt-2 border-t border-dark-500">
                                {r.category === 'private' ? (
                                    <button onClick={() => handleResourceClick(r)} className="btn-secondary py-1 text-xs flex-1 justify-center">🔒 Unlock & Open</button>
                                ) : (
                                    <>
                                        {r.type === 'link' && <a href={r.value} target="_blank" rel="noreferrer" className="btn-secondary py-1 text-xs flex-1 justify-center">🔗 Open</a>}
                                        {r.type === 'file' && <a href={r.value} target="_blank" rel="noreferrer" className="btn-secondary py-1 text-xs flex-1 justify-center">⬇️ Download</a>}
                                        {r.type === 'file' && r.value?.toLowerCase().endsWith('.pdf') && <a href={r.value.replace('/upload/', '/upload/fl_attachment:false/')} target="_blank" rel="noreferrer" className="btn-secondary py-1 text-xs flex-1 justify-center border-primary-500/30 text-primary-400">👁️ View PDF</a>}
                                        {r.type === 'text' && <button onClick={() => alert(r.value)} className="btn-secondary py-1 text-xs flex-1 justify-center">👁️ View</button>}
                                    </>
                                )}
                                <button onClick={() => { if (window.confirm('Delete?')) deleteMut.mutate(r._id) }} className="btn-danger py-1 px-2 text-xs">🗑️</button>
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && <div className="col-span-3 card text-center text-gray-500 py-10">No resources found</div>}
                </div>
            )}

            <Modal open={modal} onClose={() => setModal(false)} title="Add Resource">
                <ResourceForm onSubmit={createMut.mutate} loading={createMut.isPending} />
            </Modal>

            <AccessCodeModal open={!!accessModal} onClose={() => setAccessModal(null)} onSubmit={handleAccessCode} />
        </div>
    )
}