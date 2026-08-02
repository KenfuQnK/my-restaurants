import { Link2, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';

interface SearchPanelProps {
  loading: boolean;
  resetToken?: number;
  onSearch: (query: string) => void;
  onImport: (input: string) => void;
}

export function isSharedLinkInput(value: string): boolean {
  return /(?:https?:\/\/|www\.)/iu.test(value);
}

export function SearchPanel({
  loading,
  onSearch,
  onImport,
  resetToken = 0,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const isSharedLink = isSharedLinkInput(query);

  useEffect(() => {
    setQuery('');
  }, [resetToken]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    if (isSharedLinkInput(value)) {
      onImport(value);
      return;
    }
    onSearch(value);
  }

  return (
    <section className="search-card">
      <form className="search-form" onSubmit={submit}>
        <div className="input-with-icon">
          <Search size={20} />
          <input
            id="restaurant-search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Busca restaurantes, cocinas o barrios…"
            autoComplete="off"
            aria-label="Buscar restaurantes"
          />
        </div>
        <button className="button button-primary search-submit" type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? (
            <LoaderCircle className="spin" size={18} />
          ) : isSharedLink ? (
            <Link2 size={18} />
          ) : (
            <Search size={18} />
          )}
          {isSharedLink ? 'Analizar enlace' : 'Buscar'}
        </button>
      </form>

    </section>
  );
}
