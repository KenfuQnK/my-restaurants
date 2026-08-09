import { Link2, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

interface SearchPanelProps {
  loading: boolean;
  resetToken?: number;
  initialValue?: string;
  inputId?: string;
  onSearch: (query: string) => void;
  onImport: (input: string) => void;
  onManualAdd: () => void;
}

export function isSharedLinkInput(value: string): boolean {
  return /(?:https?:\/\/|www\.)/iu.test(value);
}

export function SearchPanel({ loading, onSearch, onImport, onManualAdd, resetToken = 0, initialValue = '', inputId = 'content-search' }: SearchPanelProps) {
  const [query, setQuery] = useState(initialValue);
  const isSharedLink = isSharedLinkInput(query);

  useEffect(() => setQuery(initialValue), [initialValue, resetToken]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    if (isSharedLinkInput(value)) onImport(value);
    else onSearch(value);
  }

  return (
    <section className="search-card">
      <form className="search-form" onSubmit={submit}>
        <div className="input-with-icon">
          <Search size={20} />
          <input
            id={inputId}
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Busca un lugar o pega un enlace de Instagram o Maps…"
            autoComplete="off"
            aria-label="Buscar o importar contenido"
          />
        </div>
        <button className="button button-primary search-submit" type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? <LoaderCircle className="spin" size={18} /> : isSharedLink ? <Link2 size={18} /> : <Search size={18} />}
          Buscar
        </button>
      </form>
      <button className="manual-add-link" type="button" onClick={onManualAdd}>¿No es un lugar? Añádelo manualmente</button>
    </section>
  );
}
