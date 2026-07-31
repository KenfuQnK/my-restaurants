import {
  Clock3,
  ExternalLink,
  Globe2,
  Heart,
  Camera,
  MapPin,
  Phone,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
import { api } from '../services/api';
import type { RestaurantPersonalData, SavedRestaurant } from '../types/restaurant';
import { formatDate, formatRating, formatReviewCount, humanizeType } from '../utils/formatters';
import { InstagramEmbed } from './InstagramEmbed';

interface RestaurantModalProps {
  restaurant: SavedRestaurant;
  onClose: () => void;
  onSavePersonal: (personal: RestaurantPersonalData) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

export function RestaurantModal({
  restaurant,
  onClose,
  onSavePersonal,
  onToggleFavorite,
  onDelete,
}: RestaurantModalProps) {
  const { external, personal, sources } = restaurant;
  const [notes, setNotes] = useState(personal.notes);
  const [tagsText, setTagsText] = useState(personal.tags.join(', '));
  const instagramSource = sources.find((source) => source.kind === 'instagram' && source.url);
  const instagramPublications = restaurant.instagramPublications ?? [];
  const primaryInstagramUrl =
    instagramPublications[0]?.normalizedUrl ?? instagramSource?.url;

  useEffect(() => {
    setNotes(personal.notes);
    setTagsText(personal.tags.join(', '));
  }, [restaurant.id, personal.notes, personal.tags]);

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

  function savePersonalData() {
    const tags = Array.from(
      new Set(
        tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ).slice(0, 12);

    onSavePersonal({ ...personal, notes: notes.trim(), tags });
  }

  function confirmDelete() {
    if (window.confirm(`¿Eliminar “${external.name}” de tu colección?`)) onDelete();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="restaurant-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={21} />
        </button>

        <div className="modal-gallery">
          {external.photos.length > 0 ? (
            external.photos.slice(0, 4).map((photo, index) => (
              <figure className={index === 0 ? 'gallery-main' : ''} key={photo.name}>
                <img src={api.photoUrl(photo.name, index === 0 ? 1200 : 640)} alt="" />
                {photo.authorAttributions?.length ? (
                  <figcaption>
                    {photo.authorAttributions.map((author) => author.displayName).filter(Boolean).join(', ')}
                  </figcaption>
                ) : null}
              </figure>
            ))
          ) : (
            <div className="modal-no-photo"><MapPin size={38} /> Sin fotografías disponibles</div>
          )}
        </div>

        <div className="modal-content">
          <div className="modal-title-row">
            <div>
              <span className="eyebrow">{external.primaryTypeLabel ?? humanizeType(external.primaryType)}</span>
              <h2 id="modal-title">{external.name}</h2>
              <p className="modal-address"><MapPin size={17} /> {external.address ?? 'Dirección no disponible'}</p>
            </div>
            <button className={`favorite-large ${personal.favorite ? 'active' : ''}`} type="button" onClick={onToggleFavorite}>
              <Heart size={22} fill={personal.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="info-stat-grid">
            <div><Star size={18} fill="currentColor" /><strong>{formatRating(external.rating)}</strong><span>{formatReviewCount(external.reviewCount)}</span></div>
            <div><MapPin size={18} /><strong>{external.city ?? 'Ciudad'}</strong><span>{external.country ?? 'No disponible'}</span></div>
          </div>

          <div className="external-actions">
            {external.googleMapsUrl && <a className="button button-primary" href={external.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={17} /></a>}
            {primaryInstagramUrl && <a className="button button-secondary" href={primaryInstagramUrl} target="_blank" rel="noreferrer noopener"><Camera size={17} /> Instagram</a>}
            {external.website && <a className="button button-secondary" href={external.website} target="_blank" rel="noreferrer"><Globe2 size={17} /> Web</a>}
          </div>

          <div className="detail-columns">
            <section className="detail-panel">
              <h3>Información</h3>
              {external.phone && <a className="detail-line" href={`tel:${external.phone}`}><Phone size={17} /><span>{external.phone}</span></a>}
              {external.openingHours.length > 0 ? (
                <div className="detail-line align-start"><Clock3 size={17} /><div>{external.openingHours.map((line) => <span className="hours-line" key={line}>{line}</span>)}</div></div>
              ) : (
                <p className="muted-copy">Horario no disponible.</p>
              )}
            </section>

            <section className="detail-panel personal-panel">
              <h3>Tu información</h3>
              <label>
                Etiquetas
                <input value={tagsText} onChange={(event: ChangeEvent<HTMLInputElement>) => setTagsText(event.target.value)} placeholder="pendiente, terraza, cena…" />
                <small>Separadas por comas.</small>
              </label>
              <label>
                Notas
                <textarea value={notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} rows={4} placeholder="Qué pedir, quién te lo recomendó…" />
              </label>
              <button className="button button-primary" type="button" onClick={savePersonalData}>Guardar cambios</button>
            </section>
          </div>

          {instagramPublications.length > 0 && (
            <section
              className="saved-instagram-section"
              aria-labelledby="saved-instagram-title"
            >
              <div className="saved-instagram-heading">
                <div>
                  <span className="eyebrow">Contenido original</span>
                  <h3 id="saved-instagram-title">
                    Publicaciones guardadas de Instagram
                  </h3>
                </div>
                <span>
                  {instagramPublications.length === 1
                    ? '1 publicación'
                    : `${instagramPublications.length} publicaciones`}
                </span>
              </div>
              <div className="saved-instagram-grid">
                {instagramPublications.map((publication) => (
                  <InstagramEmbed
                    key={publication.id}
                    publication={publication}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="modal-meta">
            <span>Guardado el {formatDate(restaurant.createdAt)}</span>
            <button className="danger-button" type="button" onClick={confirmDelete}><Trash2 size={16} /> Eliminar</button>
          </div>
        </div>
      </section>
    </div>
  );
}
