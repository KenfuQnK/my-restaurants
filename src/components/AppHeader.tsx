import { Download, Plus, Settings2, Upload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

interface AppHeaderProps {
  onFocusAdd: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function AppHeader({ onFocusAdd, onOpenSettings, onExport, onImport }: AppHeaderProps) {
  const importInputRef = useRef<HTMLInputElement>(null);

  function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  }

  return (
    <header className="app-header">
      <button className="brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Ir al inicio">
        <span className="brand-logo-crop" aria-hidden="true">
          <img src="/Logo.png" alt="" />
        </span>
        <span><strong>Retiva</strong></span>
      </button>

      <div className="header-actions">
        <button className="icon-button header-icon-button" type="button" onClick={onExport} title="Exportar copia" aria-label="Exportar copia"><Download size={18} /><span>Exportar</span></button>
        <button className="icon-button header-icon-button" type="button" onClick={() => importInputRef.current?.click()} title="Importar copia" aria-label="Importar copia"><Upload size={18} /><span>Importar</span></button>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={chooseBackup} hidden />
        <button className="icon-button header-icon-button" type="button" onClick={onOpenSettings} title="Gestionar labels" aria-label="Gestionar labels"><Settings2 size={18} /><span>Organizar</span></button>
        <button className="button button-primary button-compact" type="button" onClick={onFocusAdd}><Plus size={18} /><span>Añadir</span></button>
      </div>
    </header>
  );
}
