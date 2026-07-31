import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  ExternalPlace,
  InstagramImportStage,
  ResolvedInstagramPublication,
} from '../types/restaurant';
import { CandidateList } from './CandidateList';
import { InstagramEmbed } from './InstagramEmbed';

interface ImportPanelProps {
  instagram: ResolvedInstagramPublication;
  instagramStage: InstagramImportStage;
  importError?: string;
  onInstagramSearch: (query: string) => void;
  candidates: ExternalPlace[];
  savingPlaceId?: string;
  savedPlaceIds: Set<string>;
  onSaveCandidate: (candidate: ExternalPlace) => void;
  onClearCandidates: () => void;
  onClose: () => void;
}

export function ImportPanel({
  instagram,
  instagramStage,
  importError,
  onInstagramSearch,
  candidates,
  savingPlaceId,
  savedPlaceIds,
  onSaveCandidate,
  onClearCandidates,
  onClose,
}: ImportPanelProps) {
  const [restaurantQuery, setRestaurantQuery] = useState('');

  useEffect(() => {
    setRestaurantQuery(instagram.suggestedQuery ?? '');
  }, [instagram.publication.id, instagram.suggestedQuery]);

  function submitRestaurantSearch(event: FormEvent) {
    event.preventDefault();
    const query = restaurantQuery.trim();
    if (query.length >= 2) onInstagramSearch(query);
  }

  return (
    <section className="import-card">
      <div className="section-heading">
        <span className="eyebrow">Instagram</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar importación">
          <X size={18} />
        </button>
      </div>

      {importError && (
        <div className="import-inline-message error" role="alert">
          <AlertTriangle size={18} />
          <span>{importError}</span>
        </div>
      )}

      <section className="instagram-import-flow" aria-label="Importar contenido de Instagram">
        <div className="instagram-import-grid">
          <InstagramEmbed publication={instagram.publication} compact />

          <div className="instagram-import-controls">
            <form className="instagram-place-search" onSubmit={submitRestaurantSearch}>
              <label htmlFor="instagram-restaurant-query">
                Nombre o ubicación del restaurante
              </label>
              <div>
                <input
                  id="instagram-restaurant-query"
                  value={restaurantQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setRestaurantQuery(event.target.value)
                  }
                  placeholder="Ej.: Casa Paco Barcelona"
                  autoComplete="off"
                />
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    restaurantQuery.trim().length < 2 ||
                    instagramStage === 'searching'
                  }
                >
                  {instagramStage === 'searching' ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Search size={18} />
                  )}
                  Buscar
                </button>
              </div>
            </form>

            <CandidateList
              candidates={candidates}
              savingPlaceId={savingPlaceId}
              savedPlaceIds={savedPlaceIds}
              onSave={onSaveCandidate}
              mode="instagram"
              onClear={onClearCandidates}
            />

            {instagramStage === 'saved' && (
              <div className="import-inline-message success" role="status">
                <CheckCircle2 size={18} />
                <span>Publicación guardada.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
