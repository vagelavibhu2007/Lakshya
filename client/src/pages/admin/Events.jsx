import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvents, createEvent, updateEvent, deleteEvent, getTeams, uploadEventDocument } from '../../api'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const TYPE_ICON = { competition: '🏆', workshop: '🛠️', talk: '🎤', cultural: '🎭', fun: '🎉', other: '📌' }

function Modal({ open, onClose, title, children }) {
    if (!open) return null
    return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-dark-500"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button></div>
        <div className="p-5">{children}</div>
    </div></div>
}

function EventForm({ initial, onSubmit, loading }) {
    const { data } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = data?.data?.teams || []
    const [form, setForm] = useState(initial || { name: '', type: 'competition', description: '', date: '', venue: '', capacity: '', teamId: '', isFlagship: false, documents: [] })
    const [uploading, setUploading] = useState(false)
    const f = (k) => (v) => setForm((s) => ({ ...s, [k]: typeof v === 'object' ? v.target?.type === 'checkbox' ? v.target.checked : v.target.value : v }))

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)
        const fd = new FormData()
        fd.append('file', file)
        try {
            const res = await uploadEventDocument(fd)
            setForm(s => ({ ...s, documents: [...(s.documents || []), { title: res.data.title, url: res.data.url }] }))
            toast.success('Document attached')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed')
        } finally {
            setUploading(false)
            e.target.value = null
        }
    }

    const removeDoc = (idx) => setForm(s => ({ ...s, documents: s.documents.filter((_, i) => i !== idx) }))

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Event Name *</label><input className="input" value={form.name} onChange={f('name')} required /></div>
                <div><label className="label">Type</label>
                    <select className="input" value={form.type} onChange={f('type')}>
                        {Object.entries(TYPE_ICON).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
                    </select>
                </div>
                <div><label className="label">Date & Time *</label><input type="datetime-local" className="input" value={form.date ? form.date.slice(0, 16) : ''} onChange={f('date')} required /></div>
                <div><label className="label">Venue</label><input className="input" value={form.venue} onChange={f('venue')} /></div>
                <div><label className="label">Capacity</label><input type="number" className="input" min={1} value={form.capacity} onChange={f('capacity')} /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={f('description')} /></div>
            <div><label className="label">Coordinator Team</label>
                <select className="input" value={form.teamId} onChange={f('teamId')}>
                    <option value="">No team</option>
                    {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-dark-700 rounded-lg border border-dark-500">
                <input
                    id="isFlagship"
                    type="checkbox"
                    className="w-4 h-4 accent-yellow-400 cursor-pointer"
                    checked={!!form.isFlagship}
                    onChange={f('isFlagship')}
                />
                <label htmlFor="isFlagship" className="cursor-pointer">
                    <span className="text-white font-medium">⭐ Flagship Event</span>
                    <p className="text-xs text-gray-400 mt-0.5">CAs earn <strong className="text-yellow-400">50 pts</strong> per registration (vs 10 pts for regular events)</p>
                </label>
            </div>

            <div className="border border-dark-500 rounded-lg p-3 bg-dark-700">
                <label className="label flex items-center justify-between">
                    <span>Attached Documents ({form.documents?.length || 0})</span>
                    {uploading && <span className="text-xs text-primary-400">Uploading...</span>}
                </label>
                <div className="space-y-2 mb-3">
                    {form.documents?.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between bg-dark-600 p-2 rounded text-sm">
                            <span className="text-gray-300 truncate max-w-[200px]">{doc.title}</span>
                            <button type="button" onClick={() => removeDoc(i)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
                        </div>
                    ))}
                    {(!form.documents || form.documents.length === 0) && <p className="text-xs text-gray-500 italic">No documents attached.</p>}
                </div>
                <input type="file" className="input py-2 text-sm" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.txt" />
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || uploading}>{loading ? '⏳ Saving...' : (initial ? '💾 Update Event' : '🎪 Create Event')}</button>
        </form>
    )
}

export default function AdminEvents() {
    const { user } = useAuth()
    const qc = useQueryClient()
    const [modal, setModal] = useState(null)
    const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => getEvents({ limit: 50 }) })
    const events = data?.data?.events || []

    const createMut = useMutation({ mutationFn: createEvent, onSuccess: () => { qc.invalidateQueries(['events']); setModal(null); toast.success('Event created!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const updateMut = useMutation({ mutationFn: ({ id, ...d }) => updateEvent(id, d), onSuccess: () => { qc.invalidateQueries(['events']); setModal(null); toast.success('Event updated!') }, onError: (e) => toast.error(e.response?.data?.message || 'Error') })
    const deleteMut = useMutation({ mutationFn: deleteEvent, onSuccess: () => { qc.invalidateQueries(['events']); toast.success('Event deleted') } })

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="page-title mb-0">🎪 Events ({events.length})</h1>
                {user?.role !== 'faculty' && (
                    <button onClick={() => setModal({ type: 'create' })} className="btn-primary">➕ Add Event</button>
                )}
            </div>

            {isLoading ? <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((ev) => (
                        <div key={ev._id} className="card-hover">
                            <div className="flex items-start gap-3 mb-3">
                                <span className="text-3xl">{TYPE_ICON[ev.type] || '📌'}</span>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        {ev.name}
                                        {ev.isFlagship && <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1.5 py-0.5 rounded-full font-semibold">⭐ Flagship</span>}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                                        <span>📅 {new Date(ev.date).toLocaleString()}</span>
                                    </div>
                                    {ev.venue && <p className="text-sm text-gray-400">📍 {ev.venue}</p>}
                                    {ev.capacity && <p className="text-sm text-gray-400">👥 Capacity: {ev.capacity}</p>}
                                    {ev.teamId && <span className="badge-gray text-xs mt-1">{ev.teamId.name}</span>}
                                </div>
                            </div>
                            {ev.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{ev.description}</p>}

                            {ev.documents?.length > 0 && (
                                <div className="mb-3 space-y-1 bg-dark-700/50 p-2 rounded-lg border border-dark-500/50">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Documents</p>
                                    <div className="flex flex-wrap gap-2">
                                        {ev.documents.map((doc, idx) => (
                                            <a key={idx} href={doc.url.replace('/upload/', '/upload/fl_attachment:false/')} target="_blank" rel="noreferrer" className="badge-gray flex items-center gap-1 hover:bg-dark-500 transition-colors">
                                                📄 <span className="max-w-[100px] truncate">{doc.title}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {user?.role !== 'faculty' && (
                                <div className="flex gap-2 pt-3 border-t border-dark-500 mt-auto">
                                    <button onClick={() => setModal({ type: 'edit', event: ev })} className="btn-secondary py-1.5 text-xs flex-1 justify-center">✏️ Edit</button>
                                    <button onClick={() => { if (window.confirm('Delete event?')) deleteMut.mutate(ev._id) }} className="btn-danger py-1.5 text-xs px-3">🗑️</button>
                                </div>
                            )}
                        </div>
                    ))}
                    {events.length === 0 && <div className="col-span-1 md:col-span-2 card text-center text-gray-500 py-10">No events yet</div>}
                </div>
            )}

            <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Create Event"><EventForm onSubmit={createMut.mutate} loading={createMut.isPending} /></Modal>
            <Modal open={modal?.type === 'edit'} onClose={() => setModal(null)} title="Edit Event">
                {modal?.event && <EventForm initial={{ ...modal.event, teamId: modal.event.teamId?._id || '', date: modal.event.date }} onSubmit={(d) => updateMut.mutate({ id: modal.event._id, ...d })} loading={updateMut.isPending} />}
            </Modal>
        </div>
    )
}