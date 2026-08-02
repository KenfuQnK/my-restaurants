import { ChefHat, Download, Plus, Upload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

interface AppHeaderProps {
  count: number;
  onFocusAdd: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function AppHeader({ count, onFocusAdd, onExport, onImport }: AppHeaderProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  }
  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="Ir al inicio">
        <span className="brand-mark" aria-hidden="true">
          <ChefHat size={23} strokeWidth={2.2} />
        </span>
        <span>
          <strong>Mis Restaurantes</strong>
          <small>{count === 1 ? '1 sitio guardado' : `${count} sitios guardados`}</small>
        </span>
      </a>

      <div className="header-actions">
        <button className="button button-secondary button-compact backup-button" type="button" onClick={onExport}>
          <Download size={17} />
          <span>Exportar</span>
        </button>
        <button className="button button-secondary button-compact backup-button" type="button" onClick={() => importInputRef.current?.click()}>
          <Upload size={17} />
          <span>Importar</span>
        </button>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={chooseBackup} hidden />
      <button className="button button-primary button-compact" type="button" onClick={onFocusAdd}>
        <Plus size={18} />
        Añadir sitio
      </button>
      </div>
    </header>
  );
}
