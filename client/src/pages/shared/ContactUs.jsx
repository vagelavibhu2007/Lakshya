import { useQuery } from '@tanstack/react-query'
import { getContacts } from '../../api'

export default function ContactUs() {
    const { data, isLoading } = useQuery({ queryKey: ['contacts'], queryFn: getContacts })
    const contacts = data?.data?.contacts || []

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="page-title">📞 Contact Us</h1>
                <p className="text-gray-400 text-sm -mt-4">Get in touch with our team leads for any queries or support</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" /></div>
            ) : contacts.length === 0 ? (
                <div className="card text-center text-gray-500 py-10">No team contacts available yet</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {contacts.map((contact) => (
                        <div
                            key={contact.teamId}
                            className="card-hover relative overflow-hidden group"
                        >
                            {/* Decorative top bar in team color */}
                            <div
                                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                                style={{ background: contact.teamColor || '#6366f1' }}
                            />

                            <div className="pt-2">
                                {/* Team badge */}
                                <div className="flex items-center gap-2 mb-4">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                        style={{ background: `${contact.teamColor || '#6366f1'}30`, color: contact.teamColor || '#6366f1' }}
                                    >
                                        {contact.teamName?.[0]?.toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{contact.teamName}</h3>
                                        {contact.teamDescription && (
                                            <p className="text-xs text-gray-500 line-clamp-1">{contact.teamDescription}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Leaders info */}
                                <div className="space-y-3">
                                    {contact.leaders.map((leader) => (
                                        <div key={leader._id} className="bg-dark-700 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Team Lead</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ring-2 ring-dark-600">
                                                    {leader.name?.[0]?.toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-white text-sm truncate">{leader.name}</p>
                                                    <a
                                                        href={`mailto:${leader.email}`}
                                                        className="text-primary-400 text-xs hover:text-primary-300 transition-colors truncate block"
                                                    >
                                                        ✉️ {leader.email}
                                                    </a>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        📱 {leader.phone || 'Not provided'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Quick actions — use first leader */}
                                <div className="mt-3 flex gap-2">
                                    <a
                                        href={`mailto:${contact.leaders[0].email}`}
                                        className="btn-secondary py-2 text-xs flex-1 justify-center"
                                    >
                                        ✉️ Email
                                    </a>
                                    <a
                                        href={`mailto:${contact.leaders[0].email}?subject=TechFest Query - ${contact.teamName}`}
                                        className="btn-primary py-2 text-xs flex-1 justify-center"
                                    >
                                        💬 Quick Query
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* General contact info */}
            <div className="card border-l-4 border-l-primary-500">
                <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                        <h3 className="font-bold text-white mb-1">Need help?</h3>
                        <p className="text-sm text-gray-400">
                            Feel free to reach out to any team lead through the contact cards above.
                            For query related to this website, contact the web development team.
                        </p>
                        <div className="text-sm text-gray-300 space-y-1.5">
                            <p>📧 <a href="mailto:aryanparvani12@gmail.com" className="text-primary-400 hover:underline">aryanparvani12@gmail.com</a></p>
                            <p>📧 <a href="mailto:aakub1096@gmail.com" className="text-primary-400 hover:underline">aakub1096@gmail.com</a></p>
                            <p>📧 <a href="mailto:kvshah25092005@gmail.com" className="text-primary-400 hover:underline">kvshah25092005@gmail.com</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}