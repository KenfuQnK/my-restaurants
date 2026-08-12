import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  CategoryDetection,
  ExternalPlace,
  InstagramImportStage,
  MainCategoryId,
  ResolvedInstagramPublication,
  SavedItem,
} from '../types/restaurant';
import { CandidateList } from './CandidateList';
import { InstagramEmbed } from './InstagramEmbed';

interface ImportPanelProps {
  instagram: ResolvedInstagramPublication;
  instagramStage: InstagramImportStage;
  importError?: string;
  detection: CategoryDetection;
  onInstagramSearch: (query: string) => void;
  candidates: ExternalPlace[];
  savingPlaceId?: string;
  savedPlaceIds: Set<string>;
  savedItems: SavedItem[];
  onSaveCandidate: (candidate: ExternalPlace, categoryIds: MainCategoryId[]) => void;
  onOpenExisting: (item: SavedItem) => void;
  onClearCandidates: () => void;
  onClose: () => void;
}

export function ImportPanel({
  instagram,
  instagramStage,
  importError,
  detection,
  onInstagramSearch,
  candidates,
  savingPlaceId,
  savedPlaceIds,
  savedItems,
  onSaveCandidate,
  onOpenExisting,
  onClearCandidates,
  onClose,
}: ImportPanelProps) {
  const [placeQuery, setPlaceQuery] = useState('');
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<MainCategoryId[]>([detection.categoryId]);

  useEffect(() => {
    setPlaceQuery('');
    setManualSearchOpen(false);
    setCategoryIds([detection.categoryId]);
  }, [instagram.publication.id, detection.categoryId]);

  function submitPlaceSearch(event: FormEvent) {
    event.preventDefault();
    const query = placeQuery.trim();
    if (query.length >= 2) onInstagramSearch(query);
  }

  const manualSearch = manualSearchOpen ? (
    <form id="instagram-manual-search" className="instagram-place-search" onSubmit={submitPlaceSearch}>
      <label htmlFor="instagram-place-query">Búsqueda manual</label>
      <div>
        <input
          id="instagram-place-query"
          value={placeQuery}
          onChange={(event) => setPlaceQuery(event.target.value)}
          placeholder="Nombre o ubicación"
          autoComplete="off"
          autoFocus
        />
        <button
          className="button button-secondary"
          type="submit"
          disabled={placeQuery.trim().length < 2 || instagramStage === 'searching'}
        >
          {instagramStage === 'searching'
            ? <LoaderCircle className="spin" size={18} />
            : <Search size={18} />}
          Buscar
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className="import-card">
      <div className="section-heading">
        <div><span className="eyebrow">Instagram</span><h2>Publicación de Instagram</h2></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar importación"><X size={18} /></button>
      </div>

      {importError ? <div className="import-inline-message error" role="alert"><AlertTriangle size={18} /><span>{importError}</span></div> : null}

      <section className="instagram-import-flow" aria-label="Importar contenido de Instagram">
        <div className="instagram-import-grid">
          <div className="instagram-import-controls">
            {instagram.accounts.length > 0 ? (
              <section className="instagram-account-evidence" aria-labelledby="instagram-accounts-title">
                <div className="instagram-evidence-heading">
                  <strong id="instagram-accounts-title">Cuentas de la publicación</strong>
                  <span>{instagram.accounts.length} {instagram.accounts.length === 1 ? 'cuenta' : 'cuentas'}</span>
                </div>
                <div className="instagram-account-list">
                  {instagram.accounts.map((account) => (
                    <article key={account.username.toLocaleLowerCase('en')}>
                      <div>
                        <a href={account.profileUrl} target="_blank" rel="noreferrer noopener">@{account.username}</a>
                        {account.displayName ? <strong>{account.displayName}</strong> : null}
                      </div>
                      {account.biography ? <p>{account.biography}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <CandidateList
              candidates={candidates}
              savingPlaceId={savingPlaceId}
              savedPlaceIds={savedPlaceIds}
              savedItems={savedItems}
              onSave={onSaveCandidate}
              onOpenExisting={onOpenExisting}
              mode="instagram"
              suggestedCategoryIds={categoryIds}
              onClear={onClearCandidates}
              showWhenEmpty
              headerAction={(
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setManualSearchOpen((current) => !current)}
                  aria-expanded={manualSearchOpen}
                  aria-controls="instagram-manual-search"
                >
                  {manualSearchOpen ? 'Cerrar búsqueda manual' : 'Búsqueda manual'}
                </button>
              )}
              controls={manualSearch}
            />

            {instagramStage === 'saved' ? <div className="import-inline-message success" role="status"><CheckCircle2 size={18} /><span>Contenido guardado en Retiva.</span></div> : null}
          </div>
          <InstagramEmbed publication={instagram.publication} compact />
        </div>
      </section>
    </section>
  );
}
