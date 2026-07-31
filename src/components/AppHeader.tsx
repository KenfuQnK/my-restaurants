import { ChefHat, Plus } from 'lucide-react';

interface AppHeaderProps {
  count: number;
  onFocusAdd: () => void;
}

export function AppHeader({ count, onFocusAdd }: AppHeaderProps) {
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

      <button className="button button-primary button-compact" type="button" onClick={onFocusAdd}>
        <Plus size={18} />
        Añadir sitio
      </button>
    </header>
  );
}
