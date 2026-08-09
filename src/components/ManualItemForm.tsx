import { Link2, Save, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { MainCategoryId, ManualContentInput, UserLabel } from '../types/restaurant';
import { CategoryButtons, LabelPicker } from './CategoryControls';

interface ManualItemFormProps {
  initialCategory: MainCategoryId;
  initialTitle?: string;
  initialUrl?: string;
  labels: UserLabel[];
  onSave: (input: ManualContentInput) => void;
  onClose: () => void;
}

export function ManualItemForm({ initialCategory, initialTitle = '', initialUrl = '', labels, onSave, onClose }: ManualItemFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<MainCategoryId[]>([initialCategory]);
  const [labelIds, setLabelIds] = useState<string[]>([]);

  useEffect(() => {
    setCategoryIds([initialCategory]);
    setLabelIds([]);
    setTitle(initialTitle);
    setUrl(initialUrl);
  }, [initialCategory, initialTitle, initialUrl]);

  function changeCategories(next: MainCategoryId[]) {
    setCategoryIds(next);
    setLabelIds((current) => current.filter((id) => {
      const label = labels.find((candidate) => candidate.id === id);
      return Boolean(label && next.includes(label.categoryId));
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      url: url.trim() || undefined,
      description: description.trim() || undefined,
      categoryIds,
      labelIds,
    });
  }

  return (
    <section className="manual-item-form" aria-labelledby="manual-item-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Añadir manualmente</span>
          <h2 id="manual-item-title">Guarda cualquier idea o contenido</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit}>
        <label className="manual-title-field">
          <span>Título</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej.: Receta de focaccia"
          />
        </label>
        <label>
          <span>Enlace <small>opcional</small></span>
          <div className="field-with-icon"><Link2 size={17} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></div>
        </label>
        <label className="manual-description-field">
          <span>Descripción <small>opcional</small></span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Añade un detalle para recordarlo" />
        </label>
        <div className="manual-organize-fields">
          <CategoryButtons values={categoryIds} onChange={changeCategories} />
          <LabelPicker labels={labels} categoryIds={categoryIds} selectedIds={labelIds} onChange={setLabelIds} />
        </div>
        <button className="button button-primary manual-save" type="submit" disabled={!title.trim()}>
          <Save size={17} /> Guardar contenido
        </button>
      </form>
    </section>
  );
}
