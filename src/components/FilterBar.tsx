import { LayoutGrid, Map, MapPin, Search } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { MainCategoryId, UserLabel } from '../types/restaurant';

export type CollectionViewMode = 'list' | 'map';

interface FilterBarProps {
  search: string;
  city: string;
  labelId: string;
  cities: string[];
  labels: UserLabel[];
  categoryId?: MainCategoryId;
  supportsMap: boolean;
  viewMode: CollectionViewMode;
  onViewModeChange: (mode: CollectionViewMode) => void;
  onChange: (next: { search?: string; city?: string; labelId?: string }) => void;
}

export function FilterBar({
  search,
  city,
  labelId,
  cities,
  labels,
  categoryId,
  supportsMap,
  viewMode,
  onViewModeChange,
  onChange,
}: FilterBarProps) {
  const availableLabels = categoryId
    ? labels.filter((label) => label.categoryId === categoryId)
    : [];

  return (
    <section className="collection-toolbar" aria-label="Organizar contenido">
      <div className="filter-toolbar-row">
        <div className="filter-controls">
          <label className="compact-search"><Search size={17} /><input value={search} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ search: event.target.value })} placeholder="Buscar en esta sección" aria-label="Buscar en esta sección" /></label>
          {cities.length > 0 && (
            <label className="select-control"><MapPin size={16} /><select value={city} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ city: event.target.value })} aria-label="Filtrar por ciudad"><option value="">Todas las ciudades</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          )}
        </div>

        {supportsMap ? (
          <div className="view-toggle" aria-label="Cambiar vista">
            <button className={viewMode === 'list' ? 'active' : ''} type="button" onClick={() => onViewModeChange('list')} aria-pressed={viewMode === 'list'}><LayoutGrid size={17} /> Lista</button>
            <button className={viewMode === 'map' ? 'active' : ''} type="button" onClick={() => onViewModeChange('map')} aria-pressed={viewMode === 'map'}><Map size={17} /> Mapa</button>
          </div>
        ) : null}
      </div>

      {availableLabels.length > 0 && (
        <div className="label-filter-rail" aria-label="Filtrar por label">
          <button className={!labelId ? 'active' : ''} type="button" onClick={() => onChange({ labelId: '' })}>Todos</button>
          {availableLabels.map((label) => <button className={labelId === label.id ? 'active' : ''} key={label.id} type="button" onClick={() => onChange({ labelId: label.id === labelId ? '' : label.id })}>{label.name}</button>)}
        </div>
      )}
    </section>
  );
}
