import { useEffect, useMemo, useState } from 'react';
import { upsertRestaurant } from '../services/restaurantCollection';
import { loadRestaurants, saveRestaurants } from '../services/storage';
import type {
  ExternalPlace,
  ImportSource,
  InstagramPublication,
  RestaurantPersonalData,
  SavedRestaurant,
} from '../types/restaurant';

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState(loadRestaurants);

  useEffect(() => {
    saveRestaurants(restaurants);
  }, [restaurants]);

  const placeIds = useMemo(() => new Set(restaurants.map((item) => item.placeId)), [restaurants]);

  function addRestaurant(
    place: ExternalPlace,
    source: ImportSource,
    publication?: InstagramPublication,
  ) {
    const result = upsertRestaurant(restaurants, place, source, publication);
    setRestaurants(result.restaurants);
    return result;
  }

  function updatePersonalData(id: string, personal: RestaurantPersonalData): void {
    const now = new Date().toISOString();
    setRestaurants((current) =>
      current.map((item) => (item.id === id ? { ...item, personal, updatedAt: now } : item)),
    );
  }

  function toggleFavorite(id: string): void {
    const now = new Date().toISOString();
    setRestaurants((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              personal: { ...item.personal, favorite: !item.personal.favorite },
              updatedAt: now,
            }
          : item,
      ),
    );
  }

  function removeRestaurant(id: string): void {
    setRestaurants((current) => current.filter((item) => item.id !== id));
  }

  function replaceRestaurants(next: SavedRestaurant[]): void {
    setRestaurants(next);
  }

  return {
    restaurants,
    placeIds,
    addRestaurant,
    updatePersonalData,
    toggleFavorite,
    removeRestaurant,
    replaceRestaurants,
  };
}
