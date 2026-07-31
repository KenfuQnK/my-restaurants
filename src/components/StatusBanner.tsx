import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import type { ApiStatus } from '../types/restaurant';

interface StatusBannerProps {
  status?: ApiStatus;
}

export function StatusBanner({ status }: StatusBannerProps) {
  if (!status) {
    return (
      <div className="status-banner neutral" role="status">
        <LoaderCircle className="spin" size={16} />
        Conectando…
      </div>
    );
  }

  return (
    <div
      className={`status-banner ${status.configured ? 'success' : 'warning'}`}
      role="status"
      title={status.message}
      aria-label={status.message}
    >
      {status.configured ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
      <span>{status.configured ? 'Google Places conectado' : 'Modo demo'}</span>
    </div>
  );
}
