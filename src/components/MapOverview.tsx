import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { SavedRestaurant } from '../types/restaurant';

interface MapOverviewProps {
  restaurants: SavedRestaurant[];
  onOpen: (restaurant: SavedRestaurant) => void;
}

interface LocatedRestaurant {
  restaurant: SavedRestaurant;
  position: [number, number];
}

const BARCELONA_CENTER: LatLngExpression = [41.3874, 2.1686];
const restaurantMarker = divIcon({
  className: 'restaurant-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  tooltipAnchor: [0, -38],
});

export function MapOverview({ restaurants, onOpen }: MapOverviewProps) {
  const located = useMemo<LocatedRestaurant[]>(
    () =>
      restaurants.flatMap((restaurant) => {
        const { latitude, longitude } = restaurant.external;
        return typeof latitude === 'number' && typeof longitude === 'number'
          ? [{ restaurant, position: [latitude, longitude] }]
          : [];
      }),
    [restaurants],
  );
  const positions = useMemo(() => located.map((item) => item.position), [located]);

  return (
    <section className="map-overview" aria-label="Mapa de restaurantes">
      <MapContainer
        className="leaflet-map"
        center={BARCELONA_CENTER}
        zoom={12}
        minZoom={3}
        maxZoom={19}
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />
        <FitMapToRestaurants positions={positions} />

        {located.map(({ restaurant, position }) => (
          <Marker
            key={restaurant.id}
            position={position}
            icon={restaurantMarker}
            eventHandlers={{ click: () => onOpen(restaurant) }}
            title={restaurant.external.name}
          >
            <Tooltip direction="top">
              <strong>{restaurant.external.name}</strong>
              <span>{restaurant.external.shortAddress ?? restaurant.external.city}</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}

function FitMapToRestaurants({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      map.setView(BARCELONA_CENTER, 12);
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }

    map.fitBounds(latLngBounds(positions), {
      padding: [50, 50],
      maxZoom: 15,
    });
  }, [map, positions]);

  return null;
}
