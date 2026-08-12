import {
  Camera,
  ChevronRight,
  ExternalLink,
  Globe2,
  Heart,
  Info,
  MapPin,
  NotebookPen,
  Phone,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { getCategory, getItemCategories } from '../domain/categories';
import { api } from '../services/api';
import type { MainCategoryId, RestaurantPersonalData, SavedItem, UserLabel } from '../types/restaurant';
import { formatRating, formatReviewCount } from '../utils/formatters';
import { CategoryButtons } from './CategoryControls';
import { InstagramEmbed } from './InstagramEmbed';
import { ItemLabelEditorModal } from './ItemLabelEditorModal';

interface RestaurantModalProps {
  item: SavedItem;
  onClose: () => void;
  onSave: (personal: RestaurantPersonalData, categoryIds: MainCategoryId[]) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  labels: UserLabel[];
  onCreateLabel: (name: string, categoryId: MainCategoryId) => UserLabel | undefined;
  autoFocusCategory?: boolean;
}

interface DaySchedule {
  day: string;
  closed: boolean;
  intervals: ScheduleInterval[];
}

interface ScheduleInterval {
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
}

interface ScheduleScale {
  start: number;
  end: number;
  ticks: number[];
}

const WEEK_DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function RestaurantModal({ item, onClose, onSave, onToggleFavorite, onDelete, labels, onCreateLabel, autoFocusCategory = false }: RestaurantModalProps) {
  const { external, personal, sources } = item;
  const [notes, setNotes] = useState(personal.notes);
  const tags = personal.tags.join(', ');
  const [categoryIds, setCategoryIds] = useState<MainCategoryId[]>(getItemCategories(item));
  const [labelIds, setLabelIds] = useState<string[]>(personal.labelIds ?? []);
  const onSaveRef = useRef(onSave);
  const personalRef = useRef(personal);
  const savedSignatureRef = useRef(getPersonalSignature(personal.notes, personal.tags.join(', '), personal.labelIds ?? [], getItemCategories(item)));
  const categorySectionRef = useRef<HTMLElement>(null);
  const [labelsEditorOpen, setLabelsEditorOpen] = useState(false);
  const instagramSource = sources.find((source) => source.kind === 'instagram' && source.url);
  const instagramPublications = item.instagramPublications ?? [];
  const primaryInstagramUrl = instagramPublications[0]?.normalizedUrl ?? instagramSource?.url;
  const sourceUrl = external.sourceUrl ?? (!external.googleMapsUrl ? external.website : undefined);
  const schedule = useMemo(() => buildWeekSchedule(external.openingHours), [external.openingHours]);
  const scheduleScale = useMemo(() => buildScheduleScale(schedule), [schedule]);
  const openStatus = useMemo(() => getOpenStatus(schedule), [schedule]);
  const hasPlaceDetails = Boolean(external.address || external.phone || external.openingHours.length || external.googleMapsUrl);

  useEffect(() => {
    onSaveRef.current = onSave;
    personalRef.current = personal;
  }, [onSave, personal]);

  useEffect(() => {
    const nextTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    const nextPersonal = {
      ...personalRef.current,
      notes: notes.trim(),
      tags: nextTags,
      labelIds,
    };
    const signature = getPersonalSignature(notes, tags, labelIds, categoryIds);
    if (signature === savedSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      savedSignatureRef.current = signature;
      onSaveRef.current(nextPersonal, categoryIds);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [categoryIds, labelIds, notes, tags]);

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

  useEffect(() => {
    if (!autoFocusCategory) return;
    const timeout = window.setTimeout(() => categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
    return () => window.clearTimeout(timeout);
  }, [autoFocusCategory]);

  function changeCategories(next: MainCategoryId[]) {
    setCategoryIds(next);
    setLabelIds((current) => current.filter((id) => {
      const label = labels.find((candidate) => candidate.id === id);
      return Boolean(label && next.includes(label.categoryId));
    }));
  }

  function confirmDelete() {
    if (window.confirm(`¿Eliminar “${external.name}” de Retiva?`)) onDelete();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="restaurant-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
        <button className="modal-close icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button>

        {external.photos.length > 0 && (
          <div className="modal-gallery">
            {external.photos.slice(0, 4).map((photo, index) => (
              <figure className={index === 0 ? 'gallery-main' : ''} key={photo.name}>
                <img src={api.photoUrl(photo.name, index === 0 ? 1200 : 640)} alt="" />
                {photo.authorAttributions?.length ? <figcaption>{photo.authorAttributions.map((author) => author.displayName).filter(Boolean).join(', ')}</figcaption> : null}
              </figure>
            ))}
          </div>
        )}

        <div className="modal-content">
          <div className="modal-title-row">
            <div>
              <span className="eyebrow">{categoryIds.map((categoryId) => getCategory(categoryId).name).join(' · ')}</span>
              <h2 id="modal-title">{external.name}</h2>
              {(external.address || external.city) && <p className="modal-address"><MapPin size={17} /> {external.address ?? external.city}</p>}
              {external.description && <p className="modal-description">{external.description}</p>}
            </div>
            <button className={`favorite-large ${personal.favorite ? 'active' : ''}`} type="button" onClick={onToggleFavorite} aria-label={personal.favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}><Heart size={22} fill={personal.favorite ? 'currentColor' : 'none'} /></button>
          </div>

          {(typeof external.rating === 'number' || external.city) && (
            <div className="info-stat-grid">
              {typeof external.rating === 'number' && <div><Star size={18} fill="currentColor" /><strong>{formatRating(external.rating)}</strong><span>{formatReviewCount(external.reviewCount)}</span></div>}
              {external.city && <div><MapPin size={18} /><strong>{external.city}</strong><span>{external.country ?? 'Ubicación'}</span></div>}
            </div>
          )}

          <div className="external-actions">
            {external.googleMapsUrl && <a className="button button-primary" href={external.googleMapsUrl} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={17} /></a>}
            {primaryInstagramUrl && <a className="button button-secondary" href={primaryInstagramUrl} target="_blank" rel="noreferrer noopener"><Camera size={17} /> Instagram</a>}
            {sourceUrl && <a className="button button-secondary" href={sourceUrl} target="_blank" rel="noreferrer noopener"><Globe2 size={17} /> Abrir enlace</a>}
            {external.website && external.website !== sourceUrl && <a className="button button-secondary" href={external.website} target="_blank" rel="noreferrer"><Globe2 size={17} /> Web</a>}
          </div>

          <div className={`detail-columns ${hasPlaceDetails ? '' : 'single'}`}>
            {hasPlaceDetails && (
              <section className="detail-panel information-panel">
                <div className="detail-panel-heading">
                  <h3>Información</h3>
</div>

                {external.phone && (
                  <>
                  <a className="phone-action" href={`tel:${external.phone}`}>
                    <span className="phone-icon"><Phone size={21} /></span>
                    <strong>{external.phone}</strong>
                    <ChevronRight size={22}/>
                  </a>
                  <div className="separator">
                  </div>
                  </>
                )}

                {external.openingHours.length > 0 && (
                  <div className="weekly-schedule">
                    <div className="schedule-heading">
                      <h4>Horario semanal</h4>
                      {openStatus && <span className={`open-status ${openStatus.open ? 'open' : 'closed'}`}><i />{openStatus.label}</span>}
                    </div>
                    <div className="schedule-chart">
                      <div className="schedule-scale" aria-hidden="true">
                        <div className="schedule-scale-track">
                          {scheduleScale.ticks.map((tick) => <span style={{ left: `${getSchedulePosition(tick, scheduleScale)}%` }} key={tick}>{formatChartTime(tick)}</span>)}
                        </div>
                      </div>
                      {schedule.map((entry) => <ScheduleRow entry={entry} scale={scheduleScale} key={entry.day} />)}
                    </div>
                    <div className="schedule-legend" aria-hidden="true"><span><i className="legend-open" />Abierto</span><span><i className="legend-closed" />Cerrado</span></div>
                  </div>
                )}

                {!external.openingHours.length && external.googleMapsUrl && <a className="information-link" href={external.googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={18} /> Ver información en Google Maps <ChevronRight size={19} /></a>}
              </section>
            )}

            <section className="detail-panel personal-panel" ref={categorySectionRef}>
              <h3>Tu información</h3>
              <CategoryButtons values={categoryIds} onChange={changeCategories} />
              <section className="item-label-summary" aria-labelledby="item-label-summary-title">
                <div className="item-label-summary-heading">
                  <span id="item-label-summary-title">Labels</span>
                  <button className="text-button" type="button" onClick={() => setLabelsEditorOpen(true)}>Editar</button>
                </div>
                <div className="item-label-chips">
                  {labels.filter((label) => labelIds.includes(label.id)).map((label) => <span key={label.id}>{label.name}</span>)}
                  {labels.filter((label) => labelIds.includes(label.id)).length === 0 ? <p>Sin labels todavía.</p> : null}
                </div>
              </section>
              <label className="personal-field notes-field">
                <span>Notas</span>
                <span className="personal-input textarea-input"><NotebookPen size={21} /><textarea value={notes} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)} rows={4} placeholder="Qué pedir, quién te lo recomendó…" /></span>
              </label>
            </section>
          </div>

          {instagramPublications.length > 0 && (
            <section className="saved-instagram-section" aria-labelledby="saved-instagram-title">
              <div className="saved-instagram-heading"><div><span className="eyebrow">Contenido original</span><h3 id="saved-instagram-title">Publicaciones de Instagram</h3></div><span>{instagramPublications.length === 1 ? '1 publicación' : `${instagramPublications.length} publicaciones`}</span></div>
              <div className="saved-instagram-grid">{instagramPublications.map((publication) => <InstagramEmbed key={publication.id} publication={publication} />)}</div>
            </section>
          )}

          <div className="modal-meta"><button className="danger-button" type="button" onClick={confirmDelete}><Trash2 size={16} /> Eliminar</button></div>
        </div>
      </section>
      {labelsEditorOpen && <ItemLabelEditorModal labels={labels} selectedIds={labelIds} categoryIds={categoryIds} onChange={setLabelIds} onCreateLabel={onCreateLabel} onClose={() => setLabelsEditorOpen(false)} />}
    </div>
  );
}

function getPersonalSignature(notes: string, tags: string, labelIds: string[], categoryIds: MainCategoryId[]): string {
  return JSON.stringify({
    notes: notes.trim(),
    tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    labelIds,
    categoryIds,
  });
}

function ScheduleRow({ entry, scale }: { entry: DaySchedule; scale: ScheduleScale }) {
  return (
    <div className="schedule-row">
      <span className="schedule-day">{entry.day}</span>
      <div className="schedule-track">
        {scale.ticks.map((tick) => <i className="schedule-grid-line" style={{ left: `${getSchedulePosition(tick, scale)}%` }} key={tick} />)}
        {entry.intervals.map((interval) => {
          const left = `${getSchedulePosition(interval.start, scale)}%`;
          const width = `${((interval.end - interval.start) / (scale.end - scale.start)) * 100}%`;
          return <span className="schedule-open-bar" style={{ left, width }} key={`${interval.start}-${interval.end}`}><b>{interval.startLabel}</b><b>{interval.endLabel}</b></span>;
        })}
        {entry.closed && <span className="closed-label">Cerrado</span>}
      </div>
    </div>
  );
}

function buildWeekSchedule(lines: string[]): DaySchedule[] {
  const byDay = new Map<string, DaySchedule>();
  for (const line of lines) {
    const [rawDays = '', ...detailParts] = line.split(':');
    const details = detailParts.join(':').trim();
    const normalizedDays = normalizeText(rawDays);
    const mentionedDays = WEEK_DAYS.filter((day) => normalizedDays.includes(normalizeText(day)));
    const expandedDays = mentionedDays.length > 1 ? expandDayRange(mentionedDays[0], mentionedDays.at(-1)!) : mentionedDays;
    const closed = /cerrado|closed/u.test(normalizeText(details));
    const times = [...details.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/giu)].map((match) => parseTime(match));
    const intervals: ScheduleInterval[] = [];
    for (let index = 0; index + 1 < times.length; index += 2) {
      const start = times[index].value;
      let end = times[index + 1].value;
      if (end <= start) end += 24;
      intervals.push({ start, end, startLabel: times[index].label, endLabel: times[index + 1].label });
    }
    for (const day of expandedDays) {
      byDay.set(day, {
        day,
        closed: closed || intervals.length === 0,
        intervals,
      });
    }
  }
  return WEEK_DAYS.map((day) => byDay.get(day) ?? { day, closed: true, intervals: [] });
}

function buildScheduleScale(schedule: DaySchedule[]): ScheduleScale {
  const intervals = schedule.flatMap((entry) => entry.intervals);
  if (intervals.length === 0) return { start: 8, end: 22, ticks: [9, 12, 15, 18, 21] };

  const firstOpening = Math.min(...intervals.map((interval) => interval.start));
  const lastClosing = Math.max(...intervals.map((interval) => interval.end));
  const start = Math.max(0, Math.floor(firstOpening) - 1);
  const end = Math.min(30, Math.ceil(lastClosing) + 1);
  const range = end - start;
  const step = range <= 9 ? 2 : range <= 15 ? 3 : 4;
  const firstTick = Math.ceil(start / step) * step;
  const ticks: number[] = [];
  for (let tick = firstTick; tick <= end; tick += step) ticks.push(tick);

  return { start, end, ticks };
}

function getSchedulePosition(value: number, scale: ScheduleScale): number {
  return ((value - scale.start) / (scale.end - scale.start)) * 100;
}

function formatChartTime(value: number): string {
  const displayHour = value === 24 ? 24 : value % 24;
  return `${String(displayHour).padStart(2, '0')}:00`;
}

function expandDayRange(first: string, last: string): string[] {
  const start = WEEK_DAYS.indexOf(first);
  const end = WEEK_DAYS.indexOf(last);
  if (start < 0 || end < 0) return [];
  if (start <= end) return WEEK_DAYS.slice(start, end + 1);
  return [...WEEK_DAYS.slice(start), ...WEEK_DAYS.slice(0, end + 1)];
}

function parseTime(match: RegExpMatchArray): { value: number; label: string } {
  let hour = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const period = normalizeText(match[3] ?? '').replaceAll(' ', '');
  if (period.startsWith('p') && hour < 12) hour += 12;
  if (period.startsWith('a') && hour === 12) hour = 0;
  return { value: hour + minutes / 60, label: `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` };
}

function getOpenStatus(schedule: DaySchedule[]): { open: boolean; label: string } | undefined {
  if (!schedule.some((entry) => !entry.closed)) return undefined;
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  const entry = schedule[dayIndex];
  const current = now.getHours() + now.getMinutes() / 60;
  const currentInterval = entry.intervals.find((interval) => current >= interval.start && current <= interval.end);
  return currentInterval ? { open: true, label: `Abierto hasta ${currentInterval.endLabel}` } : { open: false, label: 'Cerrado ahora' };
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('es');
}
