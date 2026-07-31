import { Check, ExternalLink, LoaderCircle, MapPin, Plus, Star } from 'lucide-react';
import { api } from '../services/api';
import type { ExternalPlace } from '../types/restaurant';
import { formatRating, formatReviewCount, humanizeType } from '../utils/formatters';

interface CandidateListProps {
  candidates: ExternalPlace[];
  savingPlaceId?: string;
  savedPlaceIds: Set<string>;
  onSave: (place: ExternalPlace) => void;
  mode?: 'save' | 'instagram';
  onClear: () => void;
}

export function CandidateList({
  candidates,
  savingPlaceId,
  savedPlaceIds,
  onSave,
  mode = 'save',
  onClear,
}: CandidateListProps) {
  if (candidates.length === 0) return null;

  return (
    <section className="candidate-section" aria-labelledby="candidate-title">
      <div className="results-heading">
        <div>
          <h2 id="candidate-title">Coincidencias encontradas</h2>
        </div>
        <button className="text-button muted" type="button" onClick={onClear}>Cerrar resultados</button>
      </div>

      <div className="candidate-list">
        {candidates.map((place) => {
          const photo = place.photos[0];
          const alreadySaved = savedPlaceIds.has(place.placeId);
          const saving = savingPlaceId === place.placeId;
          const isInstagramImport = mode === 'instagram';

          return (
            <article
              className="candidate-card"
              key={place.placeId}
            >
              <div className="candidate-image-wrap">
                {photo ? (
                  <img src={api.photoUrl(photo.name, 480)} alt="" className="candidate-image" />
                ) : (
                  <div className="image-placeholder"><MapPin size={28} /></div>
                )}
              </div>

              <div className="candidate-content">
                <div>
                  <span className="candidate-type">{place.primaryTypeLabel ?? humanizeType(place.primaryType)}</span>
                  <h3>{place.name}</h3>
                  <p><MapPin size={15} /> {place.address ?? 'Dirección no disponible'}</p>
                </div>

                <div className="rating-row">
                  <span><Star size={15} fill="currentColor" /> {formatRating(place.rating)}</span>
                  <span>{formatReviewCount(place.reviewCount)}</span>
                </div>
              </div>

              <div className="candidate-actions">
                {place.googleMapsUrl && (
                  <a className="icon-button" href={place.googleMapsUrl} target="_blank" rel="noreferrer" title="Abrir en Google Maps">
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  className={`button ${
                    !isInstagramImport && alreadySaved
                      ? 'button-success'
                      : 'button-primary'
                  }`}
                  type="button"
                  onClick={() => onSave(place)}
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : !isInstagramImport && alreadySaved ? (
                    <Check size={18} />
                  ) : (
                    <Plus size={18} />
                  )}
                  {isInstagramImport
                    ? 'Guardar'
                    : alreadySaved
                      ? 'Actualizar'
                      : 'Guardar'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
