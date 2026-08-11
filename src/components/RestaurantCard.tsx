import { Heart } from 'lucide-react';
import { getItemCategories } from '../domain/categories';
import { api } from '../services/api';
import type { SavedItem } from '../types/restaurant';

interface RestaurantCardProps {
  item: SavedItem;
  onOpen: () => void;
  onToggleFavorite: () => void;
}

export function RestaurantCard({ item, onOpen, onToggleFavorite }: RestaurantCardProps) {
  const { external, personal } = item;
  const categoryId = getItemCategories(item)[0];
  const photo = external.photos[0];

  return (
    <article className={`restaurant-card category-${categoryId}`}>
      <button className="card-main-button" type="button" onClick={onOpen} aria-label={`Abrir ${external.name}`}>
        <div className="restaurant-image-wrap">
          {photo ? (
            <img src={api.photoUrl(photo.name, 720)} alt="" className="restaurant-image" loading="lazy" />
          ) : (
            <div className="content-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="restaurant-card-content">
          <h3>{external.name}</h3>
        </div>
      </button>
      <button className={`icon-button card-favorite ${personal.favorite ? 'favorite active' : 'favorite'}`} type="button" onClick={onToggleFavorite} title={personal.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'} aria-label={personal.favorite ? `Quitar ${external.name} de favoritos` : `Añadir ${external.name} a favoritos`}>
        <Heart size={19} fill={personal.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
