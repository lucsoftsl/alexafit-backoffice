import { useState, useRef, useEffect } from 'react'
import { createLeadUser } from '../services/api'

const COUNTRIES = [
  { code: 'AF', label: 'Afghanistan' },
  { code: 'AL', label: 'Albania' },
  { code: 'DZ', label: 'Algeria' },
  { code: 'AD', label: 'Andorra' },
  { code: 'AO', label: 'Angola' },
  { code: 'AG', label: 'Antigua and Barbuda' },
  { code: 'AR', label: 'Argentina' },
  { code: 'AM', label: 'Armenia' },
  { code: 'AU', label: 'Australia' },
  { code: 'AT', label: 'Austria' },
  { code: 'AZ', label: 'Azerbaijan' },
  { code: 'BS', label: 'Bahamas' },
  { code: 'BH', label: 'Bahrain' },
  { code: 'BD', label: 'Bangladesh' },
  { code: 'BB', label: 'Barbados' },
  { code: 'BY', label: 'Belarus' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BZ', label: 'Belize' },
  { code: 'BJ', label: 'Benin' },
  { code: 'BT', label: 'Bhutan' },
  { code: 'BO', label: 'Bolivia' },
  { code: 'BA', label: 'Bosnia and Herzegovina' },
  { code: 'BW', label: 'Botswana' },
  { code: 'BR', label: 'Brazil' },
  { code: 'BN', label: 'Brunei' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'BF', label: 'Burkina Faso' },
  { code: 'BI', label: 'Burundi' },
  { code: 'CV', label: 'Cabo Verde' },
  { code: 'KH', label: 'Cambodia' },
  { code: 'CM', label: 'Cameroon' },
  { code: 'CA', label: 'Canada' },
  { code: 'CF', label: 'Central African Republic' },
  { code: 'TD', label: 'Chad' },
  { code: 'CL', label: 'Chile' },
  { code: 'CN', label: 'China' },
  { code: 'CO', label: 'Colombia' },
  { code: 'KM', label: 'Comoros' },
  { code: 'CD', label: 'Congo (DRC)' },
  { code: 'CG', label: 'Congo (Republic)' },
  { code: 'CR', label: 'Costa Rica' },
  { code: 'HR', label: 'Croatia' },
  { code: 'CU', label: 'Cuba' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'DJ', label: 'Djibouti' },
  { code: 'DM', label: 'Dominica' },
  { code: 'DO', label: 'Dominican Republic' },
  { code: 'EC', label: 'Ecuador' },
  { code: 'EG', label: 'Egypt' },
  { code: 'SV', label: 'El Salvador' },
  { code: 'GQ', label: 'Equatorial Guinea' },
  { code: 'ER', label: 'Eritrea' },
  { code: 'EE', label: 'Estonia' },
  { code: 'SZ', label: 'Eswatini' },
  { code: 'ET', label: 'Ethiopia' },
  { code: 'FJ', label: 'Fiji' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'GA', label: 'Gabon' },
  { code: 'GM', label: 'Gambia' },
  { code: 'GE', label: 'Georgia' },
  { code: 'DE', label: 'Germany' },
  { code: 'GH', label: 'Ghana' },
  { code: 'GR', label: 'Greece' },
  { code: 'GD', label: 'Grenada' },
  { code: 'GT', label: 'Guatemala' },
  { code: 'GN', label: 'Guinea' },
  { code: 'GW', label: 'Guinea-Bissau' },
  { code: 'GY', label: 'Guyana' },
  { code: 'HT', label: 'Haiti' },
  { code: 'HN', label: 'Honduras' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IS', label: 'Iceland' },
  { code: 'IN', label: 'India' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IR', label: 'Iran' },
  { code: 'IQ', label: 'Iraq' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IL', label: 'Israel' },
  { code: 'IT', label: 'Italy' },
  { code: 'JM', label: 'Jamaica' },
  { code: 'JP', label: 'Japan' },
  { code: 'JO', label: 'Jordan' },
  { code: 'KZ', label: 'Kazakhstan' },
  { code: 'KE', label: 'Kenya' },
  { code: 'KI', label: 'Kiribati' },
  { code: 'KW', label: 'Kuwait' },
  { code: 'KG', label: 'Kyrgyzstan' },
  { code: 'LA', label: 'Laos' },
  { code: 'LV', label: 'Latvia' },
  { code: 'LB', label: 'Lebanon' },
  { code: 'LS', label: 'Lesotho' },
  { code: 'LR', label: 'Liberia' },
  { code: 'LY', label: 'Libya' },
  { code: 'LI', label: 'Liechtenstein' },
  { code: 'LT', label: 'Lithuania' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'MG', label: 'Madagascar' },
  { code: 'MW', label: 'Malawi' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'MV', label: 'Maldives' },
  { code: 'ML', label: 'Mali' },
  { code: 'MT', label: 'Malta' },
  { code: 'MH', label: 'Marshall Islands' },
  { code: 'MR', label: 'Mauritania' },
  { code: 'MU', label: 'Mauritius' },
  { code: 'MX', label: 'Mexico' },
  { code: 'FM', label: 'Micronesia' },
  { code: 'MD', label: 'Moldova' },
  { code: 'MC', label: 'Monaco' },
  { code: 'MN', label: 'Mongolia' },
  { code: 'ME', label: 'Montenegro' },
  { code: 'MA', label: 'Morocco' },
  { code: 'MZ', label: 'Mozambique' },
  { code: 'MM', label: 'Myanmar' },
  { code: 'NA', label: 'Namibia' },
  { code: 'NR', label: 'Nauru' },
  { code: 'NP', label: 'Nepal' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'NI', label: 'Nicaragua' },
  { code: 'NE', label: 'Niger' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'MK', label: 'North Macedonia' },
  { code: 'NO', label: 'Norway' },
  { code: 'OM', label: 'Oman' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'PW', label: 'Palau' },
  { code: 'PA', label: 'Panama' },
  { code: 'PG', label: 'Papua New Guinea' },
  { code: 'PY', label: 'Paraguay' },
  { code: 'PE', label: 'Peru' },
  { code: 'PH', label: 'Philippines' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'QA', label: 'Qatar' },
  { code: 'RO', label: 'Romania' },
  { code: 'RU', label: 'Russia' },
  { code: 'RW', label: 'Rwanda' },
  { code: 'KN', label: 'Saint Kitts and Nevis' },
  { code: 'LC', label: 'Saint Lucia' },
  { code: 'VC', label: 'Saint Vincent and the Grenadines' },
  { code: 'WS', label: 'Samoa' },
  { code: 'SM', label: 'San Marino' },
  { code: 'ST', label: 'Sao Tome and Principe' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'SN', label: 'Senegal' },
  { code: 'RS', label: 'Serbia' },
  { code: 'SC', label: 'Seychelles' },
  { code: 'SL', label: 'Sierra Leone' },
  { code: 'SG', label: 'Singapore' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'SI', label: 'Slovenia' },
  { code: 'SB', label: 'Solomon Islands' },
  { code: 'SO', label: 'Somalia' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'SS', label: 'South Sudan' },
  { code: 'ES', label: 'Spain' },
  { code: 'LK', label: 'Sri Lanka' },
  { code: 'SD', label: 'Sudan' },
  { code: 'SR', label: 'Suriname' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'SY', label: 'Syria' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'TJ', label: 'Tajikistan' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'TH', label: 'Thailand' },
  { code: 'TL', label: 'Timor-Leste' },
  { code: 'TG', label: 'Togo' },
  { code: 'TO', label: 'Tonga' },
  { code: 'TT', label: 'Trinidad and Tobago' },
  { code: 'TN', label: 'Tunisia' },
  { code: 'TR', label: 'Turkey' },
  { code: 'TM', label: 'Turkmenistan' },
  { code: 'TV', label: 'Tuvalu' },
  { code: 'UG', label: 'Uganda' },
  { code: 'UA', label: 'Ukraine' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'UZ', label: 'Uzbekistan' },
  { code: 'VU', label: 'Vanuatu' },
  { code: 'VE', label: 'Venezuela' },
  { code: 'VN', label: 'Vietnam' },
  { code: 'YE', label: 'Yemen' },
  { code: 'ZM', label: 'Zambia' },
  { code: 'ZW', label: 'Zimbabwe' },
]

const CountryCombobox = ({ value, onChange }) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = COUNTRIES.find(c => c.code === value)
  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = code => {
    onChange(code)
    setSearch('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={open ? search : (selected?.label ?? '')}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => { setSearch(''); setOpen(true) }}
        placeholder="Search country..."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">No countries found</li>
          ) : (
            filtered.map(c => (
              <li
                key={c.code}
                onMouseDown={() => handleSelect(c.code)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${c.code === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800'}`}
              >
                {c.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

const CreateLeadModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phoneNumber: '', country: 'RO' })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const set = (field, value) => {
    setResult(null)
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.email.trim()) { setResult({ ok: false, message: 'Email is required.' }); return }

    setSaving(true)
    setResult(null)
    try {
      const data = await createLeadUser(form)
      const msg = data?.data?.isNew === false
        ? 'Lead already existed — record updated.'
        : 'Lead user created successfully.'
      setResult({ ok: true, message: msg })
      onCreated?.()
    } catch (err) {
      setResult({ ok: false, message: err?.message || 'Failed to create lead.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex w-full max-w-2xl min-h-[70vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Add Lead from Facebook Ads</h3>
            <p className="mt-0.5 text-sm text-slate-500">Creates a website user with status &ldquo;lead&rdquo;</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="lead@example.com"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                placeholder="Ion"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                placeholder="Popescu"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={form.phoneNumber}
              onChange={e => set('phoneNumber', e.target.value)}
              placeholder="+40 700 000 000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <CountryCombobox value={form.country} onChange={v => set('country', v)} />
          </div>

          {result && (
            <div className={`rounded-xl border px-4 py-2 text-sm ${result.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {result.message}
            </div>
          )}
        </form>

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateLeadModal
