import { Edit3, Plus, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { MAIN_CATEGORIES } from '../domain/categories';
import type { MainCategoryId, UserLabel } from '../types/restaurant';
import { CategorySelect } from './CategoryControls';

interface LabelManagerModalProps {
  labels: UserLabel[];
  onClose: () => void;
  onCreate: (name: string, categoryId: MainCategoryId) => boolean;
  onUpdate: (id: string, name: string, categoryId: MainCategoryId) => boolean;
  onDelete: (id: string) => void;
}

export function LabelManagerModal({
  labels,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: LabelManagerModalProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<MainCategoryId>('hospitality');
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState('');
  const sortedLabels = useMemo(
    () => [...labels].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [labels],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const ok = editingId
      ? onUpdate(editingId, name, categoryId)
      : onCreate(name, categoryId);
    if (!ok) {
      setError('Escribe un nombre distinto para este label.');
      return;
    }
    resetForm();
  }

  function startEdit(label: UserLabel) {
    setEditingId(label.id);
    setName(label.name);
    setCategoryId(label.categoryId);
    setError('');
  }

  function resetForm() {
    setEditingId(undefined);
    setName('');
    setError('');
  }

  function confirmDelete(label: UserLabel) {
    if (window.confirm(`¿Eliminar el label “${label.name}”?`)) {
      onDelete(label.id);
      if (editingId === label.id) resetForm();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="label-manager-modal" role="dialog" aria-modal="true" aria-labelledby="label-manager-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <div className="label-manager-header">
          <div className="label-manager-icon"><Tag size={22} /></div>
          <div><span className="eyebrow">Organización</span><h2 id="label-manager-title">Gestionar labels</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>

        <form className="label-editor" onSubmit={submit}>
          <label>
            <span>Nombre</span>
            <input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ej.: Pendientes" autoFocus />
          </label>
          <CategorySelect value={categoryId} onChange={setCategoryId} compact />
          <button className="button button-primary" type="submit" disabled={!name.trim()}>
            {editingId ? <Edit3 size={16} /> : <Plus size={17} />}
            {editingId ? 'Guardar' : 'Crear label'}
          </button>
          {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancelar</button>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>

        <div className="label-groups">
          {MAIN_CATEGORIES.map((category) => {
            const categoryLabels = sortedLabels.filter((label) => label.categoryId === category.id);
            return (
              <section key={category.id}>
                <div><strong>{category.name}</strong><span>{categoryLabels.length}</span></div>
                {categoryLabels.length > 0 ? (
                  <ul>
                    {categoryLabels.map((label) => (
                      <li key={label.id}>
                        <span>{label.name}</span>
                        <button type="button" onClick={() => startEdit(label)} aria-label={`Editar ${label.name}`}><Edit3 size={15} /></button>
                        <button className="delete" type="button" onClick={() => confirmDelete(label)} aria-label={`Eliminar ${label.name}`}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                ) : <p>Sin labels todavía</p>}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
