import { useEffect, useMemo, useState } from 'react';
import { upsertRestaurant } from '../services/restaurantCollection';
import {
  loadLabels,
  loadRestaurants,
  saveLabels,
  saveRestaurants,
} from '../services/storage';
import type {
  ExternalPlace,
  ImportSource,
  InstagramPublication,
  MainCategoryId,
  RestaurantPersonalData,
  SavedRestaurant,
  UserLabel,
} from '../types/restaurant';

export function useRetiva() {
  const [items, setItems] = useState(loadRestaurants);
  const [labels, setLabels] = useState(loadLabels);

  useEffect(() => {
    saveRestaurants(items);
  }, [items]);

  useEffect(() => {
    saveLabels(labels);
  }, [labels]);

  const placeIds = useMemo(
    () => new Set(items.map((item) => item.placeId)),
    [items],
  );

  function addPlace(
    place: ExternalPlace,
    source: ImportSource,
    publication?: InstagramPublication,
    categoryIds?: MainCategoryId[],
    labelIds: string[] = [],
  ) {
    const result = upsertRestaurant(items, place, source, publication, {
      categoryIds,
      labelIds,
    });
    setItems(result.restaurants);
    return result;
  }

  function updateItem(
    id: string,
    personal: RestaurantPersonalData,
    categoryIds: MainCategoryId[],
  ): void {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, personal, categoryIds, categoryId: undefined, updatedAt: now }
          : item,
      ),
    );
  }

  function toggleFavorite(id: string): void {
    const now = new Date().toISOString();
    setItems((current) =>
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

  function removeItem(id: string): void {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function replaceItems(next: SavedRestaurant[]): void {
    setItems(next);
  }

  function replaceLabels(next: UserLabel[]): void {
    setLabels(next);
  }

  function createLabel(name: string, categoryId: MainCategoryId): UserLabel | undefined {
    const cleanName = name.trim().replace(/\s+/gu, ' ');
    if (!cleanName) return undefined;
    const duplicate = labels.some(
      (label) =>
        label.categoryId === categoryId &&
        label.name.toLocaleLowerCase('es') === cleanName.toLocaleLowerCase('es'),
    );
    if (duplicate) return undefined;
    const now = new Date().toISOString();
    const label: UserLabel = {
      id: createId(),
      name: cleanName,
      categoryId,
      createdAt: now,
      updatedAt: now,
    };
    setLabels((current) => [...current, label]);
    return label;
  }

  function updateLabel(id: string, name: string, categoryId: MainCategoryId): boolean {
    const cleanName = name.trim().replace(/\s+/gu, ' ');
    if (!cleanName) return false;
    const duplicate = labels.some(
      (label) =>
        label.id !== id &&
        label.categoryId === categoryId &&
        label.name.toLocaleLowerCase('es') === cleanName.toLocaleLowerCase('es'),
    );
    if (duplicate) return false;

    const previous = labels.find((label) => label.id === id);
    if (!previous) return false;
    setLabels((current) =>
      current.map((label) =>
        label.id === id
          ? { ...label, name: cleanName, categoryId, updatedAt: new Date().toISOString() }
          : label,
      ),
    );
    if (previous.categoryId !== categoryId) {
      setItems((current) =>
        current.map((item) =>
          item.personal.labelIds?.includes(id)
            ? {
                ...item,
                personal: {
                  ...item.personal,
                  labelIds: item.personal.labelIds.filter((labelId) => labelId !== id),
                },
              }
            : item,
        ),
      );
    }
    return true;
  }

  function deleteLabel(id: string): void {
    setLabels((current) => current.filter((label) => label.id !== id));
    setItems((current) =>
      current.map((item) => ({
        ...item,
        personal: {
          ...item.personal,
          labelIds: (item.personal.labelIds ?? []).filter((labelId) => labelId !== id),
        },
      })),
    );
  }

  return {
    items,
    labels,
    placeIds,
    addPlace,
    updateItem,
    toggleFavorite,
    removeItem,
    replaceItems,
    replaceLabels,
    createLabel,
    updateLabel,
    deleteLabel,
  };
}

export const useRestaurants = useRetiva;

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
