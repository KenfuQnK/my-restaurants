import type { ChangeEvent } from 'react';
import { Heart, LayoutGrid, MapPin, Search, UtensilsCrossed } from 'lucide-react';

interface FilterBarProps {
  search: string;
  city: string;
  category: string;
  favoritesOnly: boolean;
  cities: string[];
  categories: string[];
  resultCount: number;
  onChange: (next: { search?: string; city?: string; category?: string; favoritesOnly?: boolean }) => void;
}

export function FilterBar({
  search,
  city,
  category,
  favoritesOnly,
  cities,
  categories,
  resultCount,
  onChange,
}: FilterBarProps) {
  return (
    <section className="collection-toolbar" aria-label="Filtros de restaurantes">
      <div className="collection-topline">
        <div className="collection-title">
          <h2>{resultCount === 1 ? '1 restaurante' : `${resultCount} restaurantes`}</h2>
        </div>

        <div className="filter-controls">
          <label className="compact-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ search: event.target.value })}
              placeholder="Filtrar por nombre"
              aria-label="Filtrar la colección por nombre"
            />
          </label>

          <label className="select-control">
            <MapPin size={16} />
            <select
              value={city}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ city: event.target.value })}
              aria-label="Filtrar por ciudad"
            >
              <option value="">Todas las ciudades</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <button
            className={`favorite-filter ${favoritesOnly ? 'active' : ''}`}
            type="button"
            onClick={() => onChange({ favoritesOnly: !favoritesOnly })}
            aria-pressed={favoritesOnly}
          >
            <Heart size={16} fill={favoritesOnly ? 'currentColor' : 'none'} />
            Favoritos
          </button>
        </div>
      </div>

      <div className="category-rail" aria-label="Filtrar por tipo de cocina">
        <button
          className={`category-filter ${category === '' ? 'active' : ''}`}
          type="button"
          onClick={() => onChange({ category: '' })}
          aria-pressed={category === ''}
        >
          <LayoutGrid size={21} />
          <span>Todo</span>
        </button>
        {categories.map((item) => (
          <button
            className={`category-filter ${category === item ? 'active' : ''}`}
            key={item}
            type="button"
            onClick={() => onChange({ category: item })}
            aria-pressed={category === item}
          >
            <UtensilsCrossed size={21} strokeWidth={category === item ? 2.3 : 1.7} />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
