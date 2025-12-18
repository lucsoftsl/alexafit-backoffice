import ClientProgress from '../components/ClientProgress'

const formatDate = (val) => {
  if (!val) return 'N/A'
  try {
    return new Date(val).toLocaleDateString()
  } catch {
    return val
  }
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right truncate">{value || 'N/A'}</span>
  </div>
)

const ClientProfile = ({ client }) => {
  if (!client) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Profile</h2>
        <p className="text-gray-600">Select a client from the Clients list to view their profile.</p>
      </div>
    )
  }

  const name = client?.userData?.name || client?.loginDetails?.displayName || `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Unknown'
  const email = client?.loginDetails?.email || client?.email || 'N/A'
  const accountStatus = (client?.status || '').toString().toLowerCase()
  const statusLabel = accountStatus ? accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1) : 'Unknown'
  const assignedDate = formatDate(client?.dateTimeAssigned)
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg">
            {avatar}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
            <p className="text-gray-600">{email}</p>
          </div>
          <span className={`ml-auto px-3 py-1 text-xs font-semibold rounded-full ${accountStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <div className="divide-y divide-gray-200">
          <InfoRow label="Assigned Date" value={assignedDate} />
          <InfoRow label="User ID" value={Array.isArray(client?.userId) ? client.userId[0] : client?.userId || 'N/A'} />
          <InfoRow label="Email" value={email} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <ClientProgress client={client} />
      </div>
    </div>
  )
}

export default ClientProfile
