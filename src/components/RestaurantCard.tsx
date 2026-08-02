import { Heart, MapPin, Star } from 'lucide-react';
import { api } from '../services/api';
import type { SavedRestaurant } from '../types/restaurant';
import { formatRating, formatReviewCount, humanizeType } from '../utils/formatters';

interface RestaurantCardProps {
  restaurant: SavedRestaurant;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

export function RestaurantCard({ restaurant, onOpen, onToggleFavorite }: RestaurantCardProps) {
  const { external, personal } = restaurant;
  const photo = external.photos[0];

  return (
    <article className="restaurant-card">
      <button className="card-main-button" type="button" onClick={onOpen} aria-label={`Abrir ${external.name}`}>
        <div className="restaurant-image-wrap">
          {photo ? (
            <img src={api.photoUrl(photo.name, 720)} alt="" className="restaurant-image" loading="lazy" />
          ) : (
            <div className="image-placeholder large"><MapPin size={36} /></div>
          )}
          <span className="category-chip">{external.primaryTypeLabel ?? humanizeType(external.primaryType)}</span>
        </div>

        <div className="restaurant-card-content">
          <div className="title-line">
            <h3>{external.name}</h3>
            <span className="rating-badge"><Star size={14} fill="currentColor" /> {formatRating(external.rating)}</span>
          </div>
          <p className="address"><MapPin size={15} /> {external.shortAddress ?? external.address ?? 'Dirección no disponible'}</p>
          <p className="reviews">{formatReviewCount(external.reviewCount)}</p>
        </div>
      </button>

      <button
        className={`icon-button card-favorite ${personal.favorite ? 'favorite active' : 'favorite'}`}
        type="button"
        onClick={onToggleFavorite}
        title={personal.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
        aria-label={personal.favorite ? `Quitar ${external.name} de favoritos` : `Añadir ${external.name} a favoritos`}
      >
        <Heart size={19} fill={personal.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
