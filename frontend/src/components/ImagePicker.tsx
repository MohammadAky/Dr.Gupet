import { useRef, useState } from 'react';

/** Keep the native file chooser, with consistent Persian controls in the page. */
export function ImagePicker({
  id,
  label,
  disabled,
  onSelect,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect(file: File): void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  return (
    <div className="image-picker">
      <input
        ref={input}
        id={id}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setFileName(file.name);
          onSelect(file);
          // Selecting the same file again must work after a failed upload.
          event.target.value = '';
        }}
      />
      <button
        className="ui-button ui-button--secondary"
        type="button"
        disabled={disabled}
        aria-controls={id}
        aria-describedby={describedBy}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
      <span className="image-picker__filename" role="status">
        {fileName ? <bdi>{fileName}</bdi> : 'تصویری انتخاب نشده است.'}
      </span>
    </div>
  );
}
