import { BookmarkPlus } from 'lucide-react';
import type { SavedItem, UserLabel } from '../types/restaurant';
import { RestaurantCard } from './RestaurantCard';

interface RestaurantGridProps {
  items: SavedItem[];
  labels: UserLabel[];
  hasAnyItems: boolean;
  emptyTitle: string;
  onOpen: (item: SavedItem) => void;
  onToggleFavorite: (id: string) => void;
  onAdd: () => void;
}

export function RestaurantGrid({ items, labels, hasAnyItems, emptyTitle, onOpen, onToggleFavorite, onAdd }: RestaurantGridProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><BookmarkPlus size={28} /></span>
        <h3>{hasAnyItems ? 'No hay coincidencias' : emptyTitle}</h3>
        <p>{hasAnyItems ? 'Prueba a quitar algún filtro.' : 'Guarda aquí todo lo que quieras volver a encontrar.'}</p>
        {!hasAnyItems && <button className="button button-primary" type="button" onClick={onAdd}>Añadir contenido</button>}
      </div>
    );
  }

  return (
    <div className="restaurant-grid">
      {items.map((item) => (
        <RestaurantCard key={item.id} item={item} labels={labels} onOpen={() => onOpen(item)} onToggleFavorite={() => onToggleFavorite(item.id)} />
      ))}
    </div>
  );
}
