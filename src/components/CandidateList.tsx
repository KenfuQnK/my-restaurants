import { Check, ExternalLink, LoaderCircle, MapPin, MessageCircle, Plus, Star } from 'lucide-react';
import { type ReactNode } from 'react';
import { detectCategory, getItemCategories } from '../domain/categories';
import { api } from '../services/api';
import type { ExternalPlace, MainCategoryId, SavedItem } from '../types/restaurant';
import { formatRating, formatReviewCount, humanizeType } from '../utils/formatters';

interface CandidateListProps {
  candidates: ExternalPlace[];
  savingPlaceId?: string;
  savedPlaceIds: Set<string>;
  savedItems: SavedItem[];
  onSave: (place: ExternalPlace, categoryIds: MainCategoryId[]) => void;
  onOpenExisting: (item: SavedItem) => void;
  mode?: 'save' | 'instagram';
  suggestedCategoryIds?: MainCategoryId[];
  showWhenEmpty?: boolean;
  headerAction?: ReactNode;
  controls?: ReactNode;
  onClear: () => void;
  onWhatsApp?: (place: ExternalPlace) => void;
}

export function CandidateList({
  candidates,
  savingPlaceId,
  savedPlaceIds,
  savedItems,
  onSave,
  onOpenExisting,
  mode = 'save',
  suggestedCategoryIds,
  showWhenEmpty = false,
  headerAction,
  controls,
  onClear,
  onWhatsApp,
}: CandidateListProps) {
  if (candidates.length === 0 && !showWhenEmpty) return null;

  return (
    <section className="candidate-section" aria-labelledby="candidate-title">
      <div className="results-heading">
        <h2 id="candidate-title">Coincidencias encontradas</h2>
        <div className="results-heading-actions">
          {headerAction}
          {candidates.length > 0 ? <button className="text-button muted" type="button" onClick={onClear}>Cerrar resultados</button> : null}
        </div>
      </div>
      {controls}
      <div className="candidate-list">
        {candidates.map((place) => (
          <CandidateCard
            key={place.placeId}
            place={place}
            saving={savingPlaceId === place.placeId}
            alreadySaved={savedPlaceIds.has(place.placeId)}
            existingItem={savedItems.find((item) => item.placeId === place.placeId)}
            mode={mode}
            suggestedCategoryIds={suggestedCategoryIds}
            onSave={onSave}
            onOpenExisting={onOpenExisting}
            onWhatsApp={onWhatsApp}
          />
        ))}
      </div>
    </section>
  );
}

interface CandidateCardProps {
  place: ExternalPlace;
  saving: boolean;
  alreadySaved: boolean;
  existingItem?: SavedItem;
  mode: 'save' | 'instagram';
  suggestedCategoryIds?: MainCategoryId[];
  onSave: (place: ExternalPlace, categoryIds: MainCategoryId[]) => void;
  onOpenExisting: (item: SavedItem) => void;
  onWhatsApp?: (place: ExternalPlace) => void;
}

function CandidateCard({ place, saving, alreadySaved, existingItem, mode, suggestedCategoryIds, onSave, onOpenExisting, onWhatsApp }: CandidateCardProps) {
  const detection = detectCategory({ place });
  const categoryIds = existingItem
    ? getItemCategories(existingItem)
    : suggestedCategoryIds?.length ? suggestedCategoryIds : [detection.categoryId];
  const photo = place.photos[0];
  const isInstagramImport = mode === 'instagram';

  return (
    <article className="candidate-card">
      <div className="candidate-image-wrap">
        {photo ? <img src={api.photoUrl(photo.name, 480)} alt="" className="candidate-image" /> : <div className="image-placeholder"><MapPin size={28} /></div>}
      </div>
      <div className="candidate-content">
        <div>
          <span className="candidate-type">{place.primaryTypeLabel ?? humanizeType(place.primaryType)}</span>
          <h3>{place.name}</h3>
          <p><MapPin size={15} /> {place.address ?? 'Ubicación no disponible'}</p>
        </div>
        {typeof place.rating === 'number' && (
          <div className="rating-row"><span><Star size={15} fill="currentColor" /> {formatRating(place.rating)}</span><span>{formatReviewCount(place.reviewCount)}</span></div>
        )}
      </div>

      <div className="candidate-actions">
        {place.googleMapsUrl && <a className="icon-button" href={place.googleMapsUrl} target="_blank" rel="noreferrer" title="Abrir en Google Maps"><ExternalLink size={18} /></a>}
        {place.phone && <a className="icon-button whatsapp-action" href={`https://wa.me/${place.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label={`Abrir WhatsApp de ${place.name}`} onClick={() => onWhatsApp?.(place)}><MessageCircle size={18} /></a>}
        <button
          className={`button ${alreadySaved ? 'button-success' : 'button-primary'}`}
          type="button"
          onClick={() => existingItem ? onOpenExisting(existingItem) : onSave(place, categoryIds)}
          disabled={saving}
        >
          {saving ? <LoaderCircle className="spin" size={18} /> : alreadySaved ? <Check size={18} /> : <Plus size={18} />}
          {alreadySaved ? 'Ya guardado' : 'Guardar'}
        </button>
      </div>
    </article>
  );
}
