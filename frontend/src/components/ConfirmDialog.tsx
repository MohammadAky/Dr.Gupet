import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './ui/interactive';
import { errorText } from '../lib/labels';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  pending?: boolean;
  error?: string | null;
  destructive?: boolean;
  onClose(): void;
  onConfirm(): void | Promise<void>;
  children?: ReactNode;
}

/** Keeps context visible and prevents dismissal/duplicate writes while committing. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return props.open ? <ConfirmDialogSession {...props} /> : null;
}

function ConfirmDialogSession({ open, title, description, confirmLabel = 'حذف', pending = false,
  error, destructive = true, onClose, onConfirm, children }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const active = useRef(false);
  const writing = useRef(false);
  useLayoutEffect(() => { active.current = open; return () => { active.current = false; }; }, [open]);
  const blocked = pending || busy;
  async function confirm() {
    if (pending || writing.current) return;
    writing.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await onConfirm();
      if (active.current) onClose();
    } catch (cause) {
      if (active.current) setFailure(errorText(cause));
    } finally {
      writing.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <Dialog open={open} title={title} description={description} dismissible={!blocked}
    onClose={() => { if (!blocked) { setFailure(null); onClose(); } }}>
    <div className="confirm-dialog" aria-busy={blocked}>
      {children}
      {(failure || error) && <p role="alert">{failure || error}</p>}
      {blocked && <p role="status">در حال انجام…</p>}
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button ui-button--secondary" disabled={blocked} onClick={onClose}>انصراف</button>
        <button type="button" className={`ui-button ui-button--${destructive ? 'danger' : 'primary'}`}
          disabled={blocked} onClick={() => void confirm()}>{confirmLabel}</button>
      </div>
    </div>
  </Dialog>;
}
