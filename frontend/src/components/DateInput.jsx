// beacon2/frontend/src/components/DateInput.jsx
// Date field that accepts typed dd/mm/yyyy input and has a calendar-picker button.
// value / onChange use ISO format (YYYY-MM-DD or empty string).

import { useState, useEffect, useRef } from 'react';

function isoToDisplay(iso) {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(text) {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function DateInput({ value, onChange, onBlur, name, id, className = '', disabled, max, min }) {
  const [localText, setLocalText] = useState(() => isoToDisplay(value ?? ''));
  const pickerRef = useRef(null);

  // Sync display when value prop changes (e.g. loaded from API)
  useEffect(() => {
    setLocalText(isoToDisplay(value ?? ''));
  }, [value]);

  function handleTextChange(e) {
    const raw = e.target.value;
    setLocalText(raw);
    if (raw === '') {
      onChange?.('');
      return;
    }
    const iso = displayToIso(raw);
    if (iso) onChange?.(iso);
  }

  function handlePickerChange(e) {
    const iso = e.target.value;
    setLocalText(isoToDisplay(iso));
    onChange?.(iso);
  }

  return (
    <div className="flex gap-1 items-center">
      <input
        type="text"
        name={name}
        id={id}
        value={localText}
        onChange={handleTextChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="dd/mm/yyyy"
        maxLength={10}
        className={className}
      />
      <input
        type="date"
        ref={pickerRef}
        value={value ?? ''}
        onChange={handlePickerChange}
        disabled={disabled}
        max={max}
        min={min}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {!disabled && (
        <button
          type="button"
          onClick={() => pickerRef.current?.showPicker?.()}
          className="text-slate-400 hover:text-slate-700 p-1 flex-shrink-0"
          title="Open date picker"
        >
          📅
        </button>
      )}
    </div>
  );
}
