import { COUNTRY_CODES, parsePhone, formatPhone } from "../lib/validation";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  size?: "md" | "lg";
  id?: string;
}

const PhoneInput = ({ value, onChange, onBlur, error, placeholder = "8012345678", size = "md", id }: PhoneInputProps) => {
  const { countryCode, national } = parsePhone(value);
  const height = size === "lg" ? "h-11" : "h-10";
  const rounding = size === "lg" ? "rounded-lg" : "rounded-md";

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={countryCode}
          onChange={(e) => onChange(formatPhone(e.target.value, national))}
          className={`${height} ${rounding} border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring flex-shrink-0`}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          placeholder={placeholder}
          value={national}
          onChange={(e) => onChange(formatPhone(countryCode, e.target.value.replace(/\D/g, "")))}
          onBlur={onBlur}
          className={`flex-1 ${height} ${rounding} border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${error ? "border-red-300" : "border-input"}`}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default PhoneInput;
