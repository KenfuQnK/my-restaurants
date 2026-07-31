import { Utensils } from 'lucide-react';
import type { SavedRestaurant } from '../types/restaurant';
import { RestaurantCard } from './RestaurantCard';

interface RestaurantGridProps {
  restaurants: SavedRestaurant[];
  hasAnyRestaurants: boolean;
  onOpen: (restaurant: SavedRestaurant) => void;
  onToggleFavorite: (id: string) => void;
  onAdd: () => void;
}

export function RestaurantGrid({
  restaurants,
  hasAnyRestaurants,
  onOpen,
  onToggleFavorite,
  onAdd,
}: RestaurantGridProps) {
  if (restaurants.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Utensils size={28} /></span>
        <h3>{hasAnyRestaurants ? 'Ningún restaurante coincide' : 'Sin restaurantes guardados'}</h3>
        {!hasAnyRestaurants && <button className="button button-primary" type="button" onClick={onAdd}>Añadir restaurante</button>}
      </div>
    );
  }

  return (
    <div className="restaurant-grid">
      {restaurants.map((restaurant) => (
        <RestaurantCard
          key={restaurant.id}
          restaurant={restaurant}
          onOpen={() => onOpen(restaurant)}
          onToggleFavorite={() => onToggleFavorite(restaurant.id)}
        />
      ))}
    </div>
  );
}
