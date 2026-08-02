import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { cx } from './cx.js';

/**
 * FileDropUpload — zona de arrastrar/soltar para importaciones (§7, I1).
 *
 * Ejecuta el intent `kind: 'upload'` del contrato (enmienda 2026-08-01,
 * punto 9): el endpoint llega por props (el backend lo expone en el estado),
 * el archivo lo aporta el usuario, y se envía como multipart/form-data con
 * el campo ESTÁNDAR `file`. El componente NO conoce rutas por su cuenta.
 *
 * `onUpload` es el punto de inyección de la fuente: la pantalla pasa la
 * función que ejecuta el POST (real o mock). Sin ella, el componente hace
 * `fetch(path)` directo. El componente nunca decide el resultado: reporta
 * éxito/error y quien lo usa actualiza el estado desde el contrato.
 */
export interface FileDropUploadProps {
  /** Endpoint de upload, viene del estado (Action.intent kind:'upload'). */
  path: string;
  /** Inyección de la fuente de subida (mock hoy, API real mañana). */
  onUpload?: (file: File, path: string) => Promise<void>;
  accept?: string;
  /** Texto de ayuda (localizado; viene de la pantalla/contrato). */
  helperText?: string;
  disabled?: boolean;
  /** Razón del bloqueo si disabled (UX5). */
  disabledReason?: string;
  className?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function FileDropUpload({
  path,
  onUpload,
  accept = '.xlsx,.xls,.csv',
  helperText,
  disabled,
  disabledReason,
  className,
}: FileDropUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [fileName, setFileName] = useState<string | null>(null);

  const doUpload = async (file: File) => {
    setFileName(file.name);
    setStatus('uploading');
    try {
      if (onUpload) {
        await onUpload(file, path);
      } else {
        const body = new FormData();
        body.append('file', file); // campo estándar del contrato
        const res = await fetch(path, { method: 'POST', body });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setStatus('success');
    } catch {
      setStatus('error'); // el detalle del error llega vía estado del backend; aquí solo señalamos
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void doUpload(file);
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex min-h-40 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-6 text-center transition-colors motion-reduce:transition-none',
          disabled
            ? 'border-hairline bg-surface-2 opacity-60'
            : dragging
              ? 'border-accent bg-surface-2'
              : 'border-hairline bg-surface-1',
        )}
      >
        {status === 'uploading' ? (
          <>
            <UploadCloud aria-hidden className="h-8 w-8 text-accent motion-safe:animate-pulse" />
            <p className="text-body-base text-ink-secondary">Subiendo {fileName}…</p>
          </>
        ) : status === 'success' ? (
          <>
            <FileSpreadsheet aria-hidden className="h-8 w-8 text-success-600" />
            <p className="text-body-base text-ink-primary">{fileName}</p>
            <p className="text-body-sm text-ink-secondary">Archivo recibido. El análisis corre en el servidor.</p>
          </>
        ) : status === 'error' ? (
          <>
            <UploadCloud aria-hidden className="h-8 w-8 text-danger-600" />
            <p className="text-body-base text-ink-primary">No pudimos subir {fileName}</p>
            <button
              type="button"
              onClick={() => setStatus('idle')}
              className="min-h-btn rounded-card border border-hairline bg-surface-1 px-4 text-body-sm font-medium text-ink-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Reintentar
            </button>
          </>
        ) : (
          <>
            <UploadCloud aria-hidden className="h-8 w-8 text-ink-muted" />
            <p className="text-body-base text-ink-primary">
              Arrastra tu archivo aquí o{' '}
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                selecciónalo
              </button>
            </p>
            {helperText && <p className="text-body-sm text-ink-muted">{helperText}</p>}
          </>
        )}
      </div>

      {/* UX5: bloqueado siempre con explicación */}
      {disabled && disabledReason && (
        <p className="mt-2 text-body-sm text-ink-muted">{disabledReason}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        aria-label="Seleccionar archivo para importar"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void doUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
