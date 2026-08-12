import { Check, Plus, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import type { MainCategoryId, UserLabel } from '../types/restaurant';

interface ItemLabelEditorModalProps {
  labels: UserLabel[];
  selectedIds: string[];
  categoryIds: MainCategoryId[];
  onChange: (labelIds: string[]) => void;
  onCreateLabel: (name: string, categoryId: MainCategoryId) => UserLabel | undefined;
  onClose: () => void;
}

export function ItemLabelEditorModal({ labels, selectedIds, categoryIds, onChange, onCreateLabel, onClose }: ItemLabelEditorModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const sortedLabels = useMemo(() => [...labels].sort((a, b) => a.name.localeCompare(b.name, 'es')), [labels]);
  const defaultCategory = categoryIds.find((categoryId) => categoryId !== 'other') ?? categoryIds[0] ?? 'other';

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function toggle(labelId: string) {
    onChange(selectedIds.includes(labelId) ? selectedIds.filter((id) => id !== labelId) : [...selectedIds, labelId]);
  }

  function createLabel(event: FormEvent) {
    event.preventDefault();
    const created = onCreateLabel(name, defaultCategory);
    if (!created) {
      setError('Ese label ya existe o no es válido.');
      return;
    }
    onChange(selectedIds.includes(created.id) ? selectedIds : [...selectedIds, created.id]);
    setName('');
    setError('');
  }

  return (
    <div className="label-selection-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="label-selection-modal" role="dialog" aria-modal="true" aria-labelledby="label-selection-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <div className="label-selection-heading">
          <div><span className="eyebrow">Organización</span><h3 id="label-selection-title">Editar labels</h3></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
        <form className="label-quick-create" onSubmit={createLabel}>
          <label htmlFor="new-item-label">Nuevo label</label>
          <div><input id="new-item-label" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ej.: Para volver" autoFocus /><button className="button button-primary" type="submit" disabled={!name.trim()}><Plus size={17} /> Añadir</button></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
        <div className="label-selection-list" aria-label="Seleccionar labels">
          {sortedLabels.length > 0 ? sortedLabels.map((label) => {
            const selected = selectedIds.includes(label.id);
            return <button className={selected ? 'selected' : ''} key={label.id} type="button" onClick={() => toggle(label.id)} aria-pressed={selected}><span><Tag size={16} /> {label.name}</span>{selected ? <Check size={18} /> : null}</button>;
          }) : <p>Aún no hay labels. Crea el primero arriba.</p>}
        </div>
      </section>
    </div>
  );
}
