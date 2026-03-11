import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getTeams, sendBulkEmail, getUsers, previewTargets } from '../../api'
import toast from 'react-hot-toast'

const ROLES = [
    { id: 'admin', name: 'Admin', icon: '⚡' },
    { id: 'teamleader', name: 'Team Leader', icon: '👑' },
    { id: 'member', name: 'Member', icon: '👤' },
    { id: 'campus_ambassador', name: 'Campus Ambassador', icon: '🎓' },
]

const TEMPLATES = [
    { id: 'none', name: 'Raw HTML / No Template', icon: '📝', color: 'gray' },
    { id: 'success', name: 'Success / Announcement', icon: '✅', color: 'emerald', theme: '#10b981' },
    { id: 'congrats', name: 'Congratulations', icon: '🏆', color: 'amber', theme: '#f59e0b' },
    { id: 'warning', name: 'Important Warning', icon: '⚠️', color: 'rose', theme: '#f43f5e' },
    { id: 'formal', name: 'Formal Notification', icon: '👔', color: 'indigo', theme: '#6366f1' },
]

export default function BulkEmail() {
    const { data: teamData } = useQuery({ queryKey: ['teams'], queryFn: getTeams })
    const teams = teamData?.data?.teams || []

    const [form, setForm] = useState({
        roles: [],
        teams: [],
        specificEmails: '',
        subject: '',
        html: '',
    })

    const [userSearch, setUserSearch] = useState('')
    const [selectedUsers, setSelectedUsers] = useState([]) // Array of {id, email, name}
    const [selectedTemplate, setSelectedTemplate] = useState('formal')
    const [templateMessage, setTemplateMessage] = useState('')
    const [showPreview, setShowPreview] = useState(false)

    // 1. User Search Query
    const { data: userData, isFetching: usersLoading } = useQuery({
        queryKey: ['users-search', userSearch],
        queryFn: () => getUsers({ search: userSearch, limit: 10 }),
        enabled: userSearch.length > 2,
    })
    const searchedUsers = userData?.data?.users || []

    // 2. Target Preview Query
    const { data: previewData, isFetching: previewLoading } = useQuery({
        queryKey: ['target-preview', form.roles, form.teams],
        queryFn: () => previewTargets({ roles: form.roles.join(','), teams: form.teams.join(',') }),
        enabled: form.roles.length > 0 || form.teams.length > 0,
        placeholderData: (prev) => prev
    })
    const previewCount = previewData?.data?.count || 0
    const previewEmails = previewData?.data?.emails || []

    const sendMut = useMutation({
        mutationFn: sendBulkEmail,
        onSuccess: (res) => {
            toast.success(res.data.message || 'Emails sent successfully!')
            setForm({ roles: [], teams: [], specificEmails: '', subject: '', html: '' })
            setSelectedUsers([])
            setTemplateMessage('')
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to send emails'),
    })

    const toggleRole = (role) => {
        setForm(s => ({
            ...s,
            roles: s.roles.includes(role) ? s.roles.filter(r => r !== role) : [...s.roles, role]
        }))
    }

    const toggleTeam = (teamId) => {
        setForm(s => ({
            ...s,
            teams: s.teams.includes(teamId) ? s.teams.filter(t => t !== teamId) : [...s.teams, teamId]
        }))
    }

    const toggleUser = (u) => {
        if (selectedUsers.some(su => su._id === u._id)) {
            setSelectedUsers(selectedUsers.filter(su => su._id !== u._id))
        } else {
            setSelectedUsers([...selectedUsers, u])
        }
    }

    const generateHTML = (msg, templateId) => {
        if (templateId === 'none') return msg;

        const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[4];
        const themeColor = template.theme;
        const icon = template.icon;

        return `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background-color: ${themeColor}; padding: 32px 24px; text-align: center; color: white;">
                    <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
                    <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.025em; font-weight: 800;">TECHFEST 2026</h1>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; text-transform: uppercase; font-weight: 600;">Lakshya - Technical Management Portal</p>
                </div>
                <div style="padding: 32px 24px; background-color: white;">
                    <div style="line-height: 1.6; color: #374151; font-size: 16px;">
                        ${msg.replace(/\n/g, '<br>')}
                    </div>
                    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f3f4f6; color: #6b7280; font-size: 14px;">
                        Regards,<br>
                        <strong>Technical Management Team</strong><br>
                        TechFest 2026 Admin Panel
                    </div>
                </div>
                <div style="background-color: #f3f4f6; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px;">
                    This is an automated notification from the Technfest Management Portal.<br>
                    &copy; 2026 TechFest Organization. All rights reserved.
                </div>
            </div>
        `;
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const finalHTML = selectedTemplate === 'none' ? form.html : generateHTML(templateMessage, selectedTemplate);
        
        if (!form.subject || !finalHTML) return toast.error('Subject and content are required')
        
        const manualEmails = form.specificEmails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
        const selectedEmails = selectedUsers.map(u => u.email)
        
        const payload = {
            ...form,
            html: finalHTML,
            specificEmails: [...new Set([...manualEmails, ...selectedEmails])]
        }
        
        if (payload.roles.length === 0 && payload.teams.length === 0 && payload.specificEmails.length === 0) {
            return toast.error('Please select at least one target audience')
        }

        if (window.confirm(`Are you sure you want to blast this email to ${previewCount + payload.specificEmails.length} recipients?`)) {
            sendMut.mutate(payload)
        }
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title mb-1">📧 Bulk Email Suite</h1>
                    <p className="text-gray-500 text-sm">Reach your team instantly with professional templates</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Targeting (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Roles Card */}
                    <div className="card space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                             Target Roles
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {ROLES.map(role => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${form.roles.includes(role.id) ? 'bg-primary-500/10 border-primary-500 text-primary-400 shadow-lg shadow-primary-500/5' : 'bg-dark-700 border-dark-600 text-gray-400 opacity-60 hover:opacity-100'}`}
                                >
                                    <span className="text-2xl">{role.icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">{role.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Teams Card */}
                    <div className="card space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Target Teams</h3>
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                            {teams.map(team => (
                                <button
                                    key={team._id}
                                    type="button"
                                    onClick={() => toggleTeam(team._id)}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left text-xs ${form.teams.includes(team._id) ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-dark-400'}`}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: team.color || '#6366f1' }} />
                                    <span className="truncate font-medium">{team.name}</span>
                                    {form.teams.includes(team._id) && <span className="ml-auto text-[10px]">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Targets Info */}
                    {(form.roles.length > 0 || form.teams.length > 0) && (
                        <div className="card bg-dark-800/50 border-primary-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-primary-400 uppercase tracking-widest">Live Audience Preview</h3>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${previewCount > 0 ? 'bg-primary-500 text-white' : 'bg-dark-600 text-gray-400'}`}>
                                    {previewLoading ? '...' : previewCount} Users
                                </span>
                            </div>
                            
                            {previewCount > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                        {previewEmails.slice(0, 50).map(email => (
                                            <span key={email} className="text-[9px] bg-dark-700 text-gray-500 px-1.5 py-0.5 rounded border border-dark-600">
                                                {email}
                                            </span>
                                        ))}
                                        {previewCount > 50 && <span className="text-[9px] text-gray-600 uppercase font-bold italic">+{previewCount - 50} more...</span>}
                                    </div>
                                    <p className="text-[10px] text-gray-600 italic leading-snug">
                                        * System will automatically filter duplicate emails and only send to active users.
                                    </p>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 italic">No users found for these filters.</p>
                            )}
                        </div>
                    )}

                    {/* Individual Users Search */}
                    <div className="card space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Target Individual Users</h3>
                        <div className="space-y-3">
                            <input
                                className="input text-sm h-10"
                                placeholder="Search by name or email..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                            />
                            {userSearch.length > 2 && (
                                <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-dark-900 rounded-xl border border-dark-600 custom-scrollbar shadow-inner">
                                    {usersLoading && <div className="text-center py-2"><div className="animate-spin h-4 w-4 border-2 border-primary-500 rounded-full border-t-transparent mx-auto" /></div>}
                                    {!usersLoading && searchedUsers.length === 0 && <div className="text-center py-2 text-xs text-gray-500">No users found</div>}
                                    {searchedUsers.map(u => (
                                        <button
                                            key={u._id}
                                            type="button"
                                            onClick={() => toggleUser(u)}
                                            className={`w-full flex items-center justify-between p-2 rounded-lg hover:bg-dark-700 transition-colors text-left text-xs ${selectedUsers.some(su => su._id === u._id) ? 'bg-primary-500/10 text-primary-400' : 'text-gray-400'}`}
                                        >
                                            <div className="flex-1 min-w-0 mr-2">
                                                <p className="font-bold truncate">{u.name}</p>
                                                <p className="text-[10px] opacity-60 truncate">{u.email}</p>
                                            </div>
                                            {selectedUsers.some(su => su._id === u._id) ? '✓' : '＋'}
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {selectedUsers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {selectedUsers.map(u => (
                                        <div key={u._id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-400 text-[10px] font-medium">
                                            <span className="truncate max-w-[120px]">{u.name}</span>
                                            <button type="button" onClick={() => toggleUser(u)} className="hover:text-white transition-colors">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Custom Emails Textarea */}
                    <div className="card space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Manual External Emails</h3>
                        <textarea
                            className="input text-sm min-h-[80px]"
                            placeholder="user1@example.com, user2@example.com"
                            value={form.specificEmails}
                            onChange={(e) => setForm(s => ({ ...s, specificEmails: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Right Column: Content (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Template Picker */}
                    <div className="card space-y-4">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">1. Choose Template Theme</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {TEMPLATES.map(temp => (
                                <button
                                    key={temp.id}
                                    type="button"
                                    onClick={() => setSelectedTemplate(temp.id)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${selectedTemplate === temp.id ? `bg-${temp.color}-500/10 border-${temp.color}-500 text-${temp.color}-400 shadow-xl` : 'bg-dark-700 border-dark-600 text-gray-500 opacity-60 hover:opacity-100'}`}
                                >
                                    <span className="text-2xl">{temp.icon}</span>
                                    <span className="text-[10px] font-bold uppercase">{temp.name.split(' ')[0]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Composer */}
                    <div className="card space-y-6">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">2. Compose Content</h3>
                        <div className="space-y-5">
                            <div>
                                <label className="label text-xs uppercase tracking-widest text-gray-500">Subject Line</label>
                                <input
                                    className="input font-bold text-lg p-4 bg-dark-800 border-dark-600"
                                    placeholder="Enter email subject..."
                                    value={form.subject}
                                    onChange={(e) => setForm(s => ({ ...s, subject: e.target.value }))}
                                    required
                                />
                            </div>

                            {selectedTemplate === 'none' ? (
                                <div>
                                    <label className="label text-xs uppercase tracking-widest text-gray-500 flex items-center justify-between">
                                        Raw HTML Body
                                        <span className="text-[10px] bg-red-500/10 text-red-500 px-2 rounded font-bold">EXPERT MODE</span>
                                    </label>
                                    <textarea
                                        className="input font-mono text-sm min-h-[400px] bg-dark-900 border-dark-600"
                                        placeholder="<h1>Hello!</h1><p>Your HTML content here...</p>"
                                        value={form.html}
                                        onChange={(e) => setForm(s => ({ ...s, html: e.target.value }))}
                                        required
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="label text-xs uppercase tracking-widest text-gray-500">Message Context</label>
                                    <textarea
                                        className="input text-base min-h-[400px] bg-dark-900 border-dark-600 focus:border-primary-500 transition-colors"
                                        placeholder="Write your announcement or notification here. Use new lines for spacing. HTML is not required - we will handle the styling!"
                                        value={templateMessage}
                                        onChange={(e) => setTemplateMessage(e.target.value)}
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                         <div className="w-full md:flex-1 flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="btn-secondary py-4 md:py-5 px-6 md:px-8 text-lg md:text-xl font-bold uppercase tracking-widest justify-center border-dark-400 hover:border-primary-500 transition-all bg-dark-700/50 w-full sm:w-auto"
                            >
                                👁️ Preview
                            </button>
                            <button
                                type="submit"
                                disabled={sendMut.isPending}
                                className="btn-primary flex-1 py-4 md:py-5 text-lg md:text-xl font-black uppercase tracking-widest justify-center shadow-2xl shadow-primary-500/20 active:scale-95 transition-transform w-full"
                            >
                                {sendMut.isPending ? '⏳ Blasting Emails...' : '🚀 Blast Bulk Email'}
                            </button>
                         </div>
                         <div className="w-full md:w-1/3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                             <p className="text-[10px] text-amber-500/60 leading-tight">
                                🔒 <strong>Security Warning:</strong> This action cannot be undone. Always double check your subject and target count before blasting.
                             </p>
                         </div>
                    </div>
                </div>
            </form>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPreview(false)} />
                    <div className="relative bg-dark-800 border border-dark-600 w-full max-w-4xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-600 bg-dark-700/50">
                            <div>
                                <h2 className="text-xl font-bold text-white">Email Preview</h2>
                                <p className="text-xs text-gray-500">Subject: {form.subject || '(No Subject)'}</p>
                            </div>
                            <button onClick={() => setShowPreview(false)} className="w-10 h-10 rounded-full bg-dark-600 text-gray-400 hover:text-white flex items-center justify-center transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-hidden bg-white p-4">
                            <iframe
                                title="Email Preview"
                                className="w-full h-full border-none"
                                srcDoc={selectedTemplate === 'none' ? form.html : generateHTML(templateMessage, selectedTemplate)}
                            />
                        </div>
                        <div className="px-6 py-4 bg-dark-700/50 border-t border-dark-600 flex justify-end gap-3 text-sm">
                            <p className="text-gray-500 mr-auto flex items-center gap-2 italic">
                                📱 Previewing responsive layout
                            </p>
                            <button onClick={() => setShowPreview(false)} className="px-6 py-2 rounded-xl bg-dark-600 text-white font-bold hover:bg-dark-500 transition-colors">Close Preview</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}