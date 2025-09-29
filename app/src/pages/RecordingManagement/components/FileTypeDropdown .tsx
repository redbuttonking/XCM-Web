import { ChevronDown } from 'lucide-react';

type Option = { label: string; value: string };

export default function FileTypeDropdown({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative w-[180px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-10 text-sm text-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 드롭다운 화살표 */}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
