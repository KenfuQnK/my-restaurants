import { Check } from 'lucide-react';
import { MAIN_CATEGORIES } from '../domain/categories';
import type { MainCategoryId, UserLabel } from '../types/restaurant';

interface CategorySelectProps {
  value: MainCategoryId;
  onChange: (categoryId: MainCategoryId) => void;
  compact?: boolean;
  suggested?: boolean;
}

export function CategorySelect({
  value,
  onChange,
  compact = false,
  suggested = false,
}: CategorySelectProps) {
  return (
    <label className={`category-select ${compact ? 'compact' : ''}`}>
      <span>{suggested ? 'Categoría sugerida' : 'Categoría'}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as MainCategoryId)}
      >
        {MAIN_CATEGORIES.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
    </label>
  );
}

interface CategoryButtonsProps {
  values: MainCategoryId[];
  onChange: (categoryIds: MainCategoryId[]) => void;
  suggested?: boolean;
}

export function CategoryButtons({
  values,
  onChange,
  suggested = false,
}: CategoryButtonsProps) {
  return (
    <fieldset className="category-buttons">
      <legend>{suggested ? 'Categoría sugerida' : 'Categoría'}</legend>
      <div>
        {MAIN_CATEGORIES.map((category) => {
          const selected = values.includes(category.id);
          return (
            <button
              className={selected ? 'selected' : ''}
              key={category.id}
              type="button"
              onClick={() => {
                if (selected && values.length === 1) return;
                onChange(selected
                  ? values.filter((categoryId) => categoryId !== category.id)
                  : [...values, category.id]);
              }}
              aria-pressed={selected}
            >
              {selected ? <Check size={14} /> : null}
              {category.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface LabelPickerProps {
  labels: UserLabel[];
  categoryIds: MainCategoryId[];
  selectedIds: string[];
  onChange: (labelIds: string[]) => void;
  compact?: boolean;
}

export function LabelPicker({
  labels,
  categoryIds,
  selectedIds,
  onChange,
  compact = false,
}: LabelPickerProps) {
  const available = labels.filter((label) => categoryIds.includes(label.categoryId));
  if (available.length === 0) return null;

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  return (
    <fieldset className={`label-picker ${compact ? 'compact' : ''}`}>
      <legend>Labels</legend>
      <div>
        {available.map((label) => {
          const selected = selectedIds.includes(label.id);
          return (
            <button
              className={selected ? 'selected' : ''}
              key={label.id}
              type="button"
              onClick={() => toggle(label.id)}
              aria-pressed={selected}
            >
              {selected && <Check size={13} />}
              {label.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
