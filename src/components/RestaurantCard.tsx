import { BedDouble, Heart, MapPin, Shapes, Star, UtensilsCrossed } from 'lucide-react';
import { getCategory, getItemCategories } from '../domain/categories';
import { api } from '../services/api';
import type { SavedItem, UserLabel } from '../types/restaurant';
import { formatRating } from '../utils/formatters';

interface RestaurantCardProps {
  item: SavedItem;
  labels: UserLabel[];
  onOpen: () => void;
  onToggleFavorite: () => void;
}

const CATEGORY_ICONS = {
  hospitality: UtensilsCrossed,
  stays: BedDouble,
  places: MapPin,
  other: Shapes,
};

export function RestaurantCard({ item, labels, onOpen, onToggleFavorite }: RestaurantCardProps) {
  const { external, personal } = item;
  const categoryIds = getItemCategories(item);
  const categoryId = categoryIds[0];
  const categoryNames = categoryIds.map((id) => getCategory(id).name).join(' · ');
  const CategoryIcon = CATEGORY_ICONS[categoryId];
  const photo = external.photos[0];
  const assignedLabels = labels.filter((label) => personal.labelIds?.includes(label.id));
  const location = external.shortAddress ?? external.address ?? external.city;
  const sourceText = item.sources.some((source) => source.kind === 'instagram')
    ? 'Guardado desde Instagram'
    : external.sourceUrl
      ? 'Contenido enlazado'
      : 'Añadido manualmente';

  return (
    <article className={`restaurant-card category-${categoryId}`}>
      <button className="card-main-button" type="button" onClick={onOpen} aria-label={`Abrir ${external.name}`}>
        <div className="restaurant-image-wrap">
          {photo ? (
            <img src={api.photoUrl(photo.name, 720)} alt="" className="restaurant-image" loading="lazy" />
          ) : (
            <div className="content-placeholder"><CategoryIcon size={34} /></div>
          )}
          <span className="category-chip">{categoryNames}</span>
        </div>
        <div className="restaurant-card-content">
          <div className="title-line">
            <h3>{external.name}</h3>
            {typeof external.rating === 'number' && <span className="rating-badge"><Star size={14} fill="currentColor" /> {formatRating(external.rating)}</span>}
          </div>
          <p className="address"><MapPin size={15} /> {location ?? sourceText}</p>
          {assignedLabels.length > 0 && <div className="tag-list">{assignedLabels.slice(0, 3).map((label) => <span key={label.id}>{label.name}</span>)}</div>}
        </div>
      </button>
      <button className={`icon-button card-favorite ${personal.favorite ? 'favorite active' : 'favorite'}`} type="button" onClick={onToggleFavorite} title={personal.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'} aria-label={personal.favorite ? `Quitar ${external.name} de favoritos` : `Añadir ${external.name} a favoritos`}>
        <Heart size={19} fill={personal.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
