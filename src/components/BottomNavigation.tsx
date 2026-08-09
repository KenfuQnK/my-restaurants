import {
  BedDouble,
  Heart,
  MapPinned,
  Shapes,
  UtensilsCrossed,
} from 'lucide-react';
import type { MainCategoryId } from '../types/restaurant';

export type NavigationTarget = MainCategoryId | 'favorites';

interface BottomNavigationProps {
  active: NavigationTarget;
  onChange: (target: NavigationTarget) => void;
}

const ENTRIES: Array<{
  id: NavigationTarget;
  label: string;
  icon: typeof UtensilsCrossed;
}> = [
  { id: 'hospitality', label: 'Hostelería', icon: UtensilsCrossed },
  { id: 'stays', label: 'Estancias', icon: BedDouble },
  { id: 'places', label: 'Lugares', icon: MapPinned },
  { id: 'other', label: 'Otros', icon: Shapes },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
];

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation" aria-label="Secciones principales">
      {ENTRIES.map((entry) => {
        const Icon = entry.icon;
        const isActive = active === entry.id;
        return (
          <button
            className={isActive ? 'active' : ''}
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={21} fill={entry.id === 'favorites' && isActive ? 'currentColor' : 'none'} />
            <span>{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
