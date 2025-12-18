import { memo } from 'react'

const FormSelect = memo(({ label, name, value, onChange, options, required = false }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
    >
      <option value="">Select {label}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
))

FormSelect.displayName = 'FormSelect'

export default FormSelect
