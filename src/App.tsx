import { AlertTriangle, CheckCircle2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCategory, getItemCategories, detectCategory } from './domain/categories';
import { AppHeader } from './components/AppHeader';
import { BottomNavigation, type NavigationTarget } from './components/BottomNavigation';
import { CandidateList } from './components/CandidateList';
import { FilterBar, type CollectionViewMode } from './components/FilterBar';
import { ImportPanel } from './components/ImportPanel';
import { LabelManagerModal } from './components/LabelManagerModal';
import { ManualItemForm } from './components/ManualItemForm';
import { MapOverview } from './components/MapOverview';
import { RestaurantGrid } from './components/RestaurantGrid';
import { RestaurantModal } from './components/RestaurantModal';
import { SearchPanel } from './components/SearchPanel';
import { useRetiva } from './hooks/useRestaurants';
import { api } from './services/api';
import {
  mergeRestaurantCollections,
  parseLabelsFromBackup,
  parseRestaurantBackup,
} from './services/storage';
import type {
  ExternalPlace,
  ImportSource,
  InstagramImportStage,
  MainCategoryId,
  ManualContentInput,
  ResolvedInstagramPublication,
  SavedItem,
  SearchLocation,
  UserLabel,
} from './types/restaurant';

interface ToastState {
  kind: 'success' | 'error';
  message: string;
}

interface ManualPrefill {
  title?: string;
  url?: string;
}

const FAVORITES_DESCRIPTION = 'Todo lo que has marcado como favorito, reunido en un solo lugar.';

function App() {
  const {
    items,
    labels,
    placeIds,
    addPlace,
    addManual,
    updateItem,
    toggleFavorite,
    removeItem,
    replaceItems,
    replaceLabels,
    createLabel,
    updateLabel,
    deleteLabel,
  } = useRetiva();

  const [activeTarget, setActiveTarget] = useState<NavigationTarget>('hospitality');
  const [viewMode, setViewMode] = useState<CollectionViewMode>('list');
  const [candidates, setCandidates] = useState<ExternalPlace[]>([]);
  const [instagramImport, setInstagramImport] = useState<ResolvedInstagramPublication>();
  const [instagramStage, setInstagramStage] = useState<InstagramImportStage>('waiting');
  const [importError, setImportError] = useState<string>();
  const [pendingSource, setPendingSource] = useState<ImportSource>();
  const [selectedItem, setSelectedItem] = useState<SavedItem>();
  const [manualPrefill, setManualPrefill] = useState<ManualPrefill>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modalSearchValue, setModalSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingPlaceId, setSavingPlaceId] = useState<string>();
  const [toast, setToast] = useState<ToastState>();
  const [searchResetToken, setSearchResetToken] = useState(0);
  const [filters, setFilters] = useState({ search: '', city: '', labelId: '' });

  const sharedInputHandledRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 4_500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!searchOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeSearchModal();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
    };
  }, [searchOpen]);

  useEffect(() => {
    if (sharedInputHandledRef.current) return;
    const sharedInput = new URLSearchParams(window.location.search).get('share_url')?.trim();
    if (!sharedInput) return;
    sharedInputHandledRef.current = true;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('share_url');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    setModalSearchValue(sharedInput);
    setSearchOpen(true);
    void handleImport(sharedInput);
  }, []);

  const sectionItems = useMemo(
    () => activeTarget === 'favorites'
      ? items.filter((item) => item.personal.favorite)
      : items.filter((item) => getItemCategories(item).includes(activeTarget)),
    [activeTarget, items],
  );

  const cities = useMemo(
    () => Array.from(new Set(sectionItems.map((item) => item.external.city).filter((city): city is string => Boolean(city)))).sort((a, b) => a.localeCompare(b, 'es')),
    [sectionItems],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLocaleLowerCase('es');
    return sectionItems
      .filter((item) => {
        const assignedLabels = labels.filter((label) => item.personal.labelIds?.includes(label.id));
        const haystack = [item.external.name, item.external.address, item.external.city, item.external.description, item.personal.notes, ...assignedLabels.map((label) => label.name)].filter(Boolean).join(' ').toLocaleLowerCase('es');
        return (
          (!normalizedSearch || haystack.includes(normalizedSearch)) &&
          (!filters.city || item.external.city === filters.city) &&
          (!filters.labelId || item.personal.labelIds?.includes(filters.labelId))
        );
      })
      .sort((a, b) => {
        if (a.personal.favorite !== b.personal.favorite) return a.personal.favorite ? -1 : 1;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [filters, labels, sectionItems]);

  const activeCategory = activeTarget === 'favorites' ? undefined : getCategory(activeTarget);
  const pageTitle = activeTarget === 'favorites' ? 'Favoritos' : activeCategory?.name ?? 'Retiva';
  const pageDescription = activeTarget === 'favorites' ? FAVORITES_DESCRIPTION : activeCategory?.shortDescription ?? '';
  const supportsMap = Boolean(activeCategory?.supportsMap);
  const homeSearchTitle = activeTarget === 'hospitality'
    ? '¿Dónde comemos hoy?'
    : activeTarget === 'stays'
      ? '¿Dónde dormimos hoy?'
      : activeTarget === 'places'
        ? '¿Dónde vamos hoy?'
        : undefined;
  const instagramDetection = useMemo(() => {
    if (!instagramImport) return { categoryId: 'other' as const, confidence: 'low' as const };
    const text = [
      instagramImport.publication.caption,
      instagramImport.publication.authorName,
      ...instagramImport.accounts.flatMap((account) => [account.displayName, account.biography, account.username]),
      ...instagramImport.searchSuggestions.map((suggestion) => suggestion.query),
    ].filter(Boolean).join(' ');
    const textDetection = detectCategory({ text });
    if (textDetection.categoryId !== 'other') return textDetection;

    for (const candidate of candidates) {
      const placeDetection = detectCategory({ place: candidate });
      if (placeDetection.confidence === 'high') return placeDetection;
    }

    return textDetection;
  }, [candidates, instagramImport]);

  async function runSearch(query: string, source: ImportSource, searchLocation?: SearchLocation, instagramFlow = false) {
    setLoading(true);
    setPendingSource(source);
    if (instagramFlow) {
      setInstagramStage('searching');
      setImportError(undefined);
    }
    try {
      const places = await api.searchPlaces(query, searchLocation);
      setCandidates(places);
      if (places.length === 0) {
        const message = 'No se han encontrado sitios. Prueba con el nombre y la ciudad.';
        if (instagramFlow) {
          setInstagramStage('awaiting_search');
          setImportError(message);
        }
        setToast({ kind: 'error', message });
      } else if (instagramFlow) setInstagramStage('candidates');
    } catch (error) {
      setCandidates([]);
      const message = getErrorMessage(error);
      if (instagramFlow) {
        setInstagramStage('awaiting_search');
        setImportError(message);
      }
      setToast({ kind: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  async function runInstagramAccountSearches(
    instagram: ResolvedInstagramPublication,
    source: ImportSource,
  ) {
    const queries = Array.from(new Set(
      instagram.searchSuggestions
        .map((suggestion) => suggestion.query.trim())
        .filter((query) => query.length >= 2),
    ));

    if (queries.length === 0 && instagram.suggestedQuery) {
      queries.push(instagram.suggestedQuery);
    }
    if (queries.length === 0) {
      setInstagramStage('awaiting_search');
      return;
    }

    setLoading(true);
    setPendingSource(source);
    setInstagramStage('searching');
    setImportError(undefined);

    const searches = await Promise.all(
      queries.map(async (query) => {
        try {
          return await api.searchPlaces(query);
        } catch {
          return [];
        }
      }),
    );

    const uniquePlaces = new Map<string, ExternalPlace>();
    for (const places of searches) {
      for (const place of places) {
        if (!uniquePlaces.has(place.placeId)) uniquePlaces.set(place.placeId, place);
      }
    }

    const places = Array.from(uniquePlaces.values());
    setCandidates(places);
    setInstagramStage(places.length > 0 ? 'candidates' : 'awaiting_search');
    if (places.length === 0) setImportError('No se han encontrado coincidencias.');
    setLoading(false);
  }

  function handleManualSearch(query: string) {
    resetInstagramSession();
    setManualPrefill(undefined);
    void runSearch(query, { kind: 'manual_search', originalInput: query, importedAt: new Date().toISOString() });
  }

  async function handleImport(input: string) {
    setLoading(true);
    setCandidates([]);
    setInstagramImport(undefined);
    setInstagramStage('validating');
    setImportError(undefined);
    setManualPrefill(undefined);
    try {
      const resolved = await api.resolveImport(input);
      if (resolved.source === 'instagram') {
        setInstagramStage('resolving');
        const instagram = await api.resolveInstagram(input);
        setInstagramImport(instagram);
        const source: ImportSource = { kind: 'instagram', originalInput: input, url: instagram.publication.originalUrl, importedAt: new Date().toISOString() };
        setPendingSource(source);
        setLoading(false);
        await runInstagramAccountSearches(instagram, source);
        return;
      }

      setInstagramStage('waiting');
      if (resolved.source === 'google_maps' && resolved.query) {
        const source: ImportSource = { kind: resolved.source, originalInput: resolved.originalInput, url: resolved.url, importedAt: new Date().toISOString() };
        setLoading(false);
        await runSearch(resolved.query, source, resolved.coordinates);
        return;
      }

      const url = resolved.url ?? resolved.finalUrl;
      setManualPrefill({ title: resolved.query || titleFromUrl(url), url });
    } catch (error) {
      const message = getErrorMessage(error);
      setInstagramStage('error');
      setImportError(message);
      setToast({ kind: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  function handleInstagramSearch(query: string) {
    if (!instagramImport) return;
    const source = pendingSource ?? { kind: 'instagram' as const, originalInput: instagramImport.publication.originalUrl, url: instagramImport.publication.originalUrl, importedAt: new Date().toISOString() };
    void runSearch(query, source, undefined, true);
  }

  async function handleSaveCandidate(candidate: ExternalPlace, categoryIds: MainCategoryId[], labelIds: string[]) {
    const existing = items.find((item) => item.placeId === candidate.placeId);
    if (existing) {
      openExistingItem(existing);
      return;
    }
    setSavingPlaceId(candidate.placeId);
    try {
      const details = await api.getPlaceDetails(candidate.placeId);
      const source = pendingSource ?? { kind: 'manual_search' as const, importedAt: new Date().toISOString() };
      const result = addPlace(details, source, undefined, categoryIds, labelIds);
      closeSearchModal();
      setSelectedItem(result.restaurant);
      setToast({ kind: 'success', message: 'Guardado en Retiva.' });
    } catch (error) {
      setToast({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setSavingPlaceId(undefined);
    }
  }

  async function handleSaveInstagramCandidate(candidate: ExternalPlace, categoryIds: MainCategoryId[], labelIds: string[]) {
    if (!instagramImport) return;
    const existing = items.find((item) => item.placeId === candidate.placeId);
    if (existing) {
      openExistingItem(existing);
      return;
    }
    setSavingPlaceId(candidate.placeId);
    try {
      const details = await api.getPlaceDetails(candidate.placeId);
      const source = pendingSource ?? { kind: 'instagram' as const, originalInput: instagramImport.publication.originalUrl, url: instagramImport.publication.originalUrl, importedAt: new Date().toISOString() };
      const result = addPlace(details, source, instagramImport.publication, categoryIds, labelIds);
      closeSearchModal();
      setSelectedItem(result.restaurant);
      setToast({ kind: 'success', message: 'Publicación guardada.' });
    } catch (error) {
      const message = getErrorMessage(error);
      setImportError(`No se ha podido guardar: ${message}`);
      setToast({ kind: 'error', message });
    } finally {
      setSavingPlaceId(undefined);
    }
  }

  function handleManualContentSave(input: ManualContentInput) {
    const item = addManual(input);
    closeSearchModal();
    setSelectedItem(item);
    setActiveTarget(input.categoryIds[0]);
    setToast({ kind: 'success', message: 'Contenido guardado.' });
  }

  function clearCandidates() {
    setCandidates([]);
    if (instagramImport && instagramStage !== 'saved') setInstagramStage('awaiting_search');
  }

  function resetInstagramSession() {
    setInstagramImport(undefined);
    setInstagramStage('waiting');
    setImportError(undefined);
    setCandidates([]);
  }

  function openSearchModal() {
    resetSearchSession();
    setModalSearchValue('');
    setSearchOpen(true);
    window.setTimeout(() => document.getElementById('content-search')?.focus(), 50);
  }

  function closeSearchModal() {
    setSearchOpen(false);
    resetSearchSession();
    setModalSearchValue('');
  }

  function resetSearchSession() {
    setPendingSource(undefined);
    setManualPrefill(undefined);
    resetInstagramSession();
    setSearchResetToken((current) => current + 1);
  }

  function openExistingItem(item: SavedItem) {
    closeSearchModal();
    setSelectedItem(item);
  }

  function searchFromHome(query: string) {
    resetSearchSession();
    setModalSearchValue(query);
    setSearchOpen(true);
    handleManualSearch(query);
  }

  function importFromHome(input: string) {
    resetSearchSession();
    setModalSearchValue(input);
    setSearchOpen(true);
    void handleImport(input);
  }

  function openManualAddFromHome() {
    openSearchModal();
    setManualPrefill({});
  }

  function openManualAdd() {
    resetInstagramSession();
    setManualPrefill({});
  }

  function exportBackup() {
    const backup = { format: 'retiva', version: 2, exportedAt: new Date().toISOString(), items, labels };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retiva-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast({ kind: 'success', message: 'Copia descargada.' });
  }

  async function importBackup(file: File) {
    try {
      const raw = await file.text();
      const importedItems = parseRestaurantBackup(raw);
      const importedLabels = parseLabelsFromBackup(raw);
      const result = mergeRestaurantCollections(items, importedItems);
      replaceItems(result.restaurants);
      if (importedLabels.length > 0) replaceLabels(mergeLabels(labels, importedLabels));
      setToast({ kind: 'success', message: result.added + result.updated > 0 ? `Copia importada: ${result.added} nuevos y ${result.updated} actualizados.` : 'La copia ya estaba incluida en Retiva.' });
    } catch (error) {
      setToast({ kind: 'error', message: getErrorMessage(error) });
    }
  }

  function changeNavigation(target: NavigationTarget) {
    setActiveTarget(target);
    setFilters({ search: '', city: '', labelId: '' });
    setViewMode('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div id="top" className="app-shell">
      <AppHeader count={items.length} onFocusAdd={openSearchModal} onOpenSettings={() => setSettingsOpen(true)} onExport={exportBackup} onImport={(file) => void importBackup(file)} />

      <main className="workspace">
        <div className="content-container">
          {homeSearchTitle ? (
            <section className="command-center home-search-command" aria-labelledby="home-search-title">
              <div className="command-heading"><h1 id="home-search-title">{homeSearchTitle}</h1></div>
              <SearchPanel loading={loading} resetToken={searchResetToken} inputId="home-content-search" onSearch={searchFromHome} onImport={importFromHome} onManualAdd={openManualAddFromHome} />
            </section>
          ) : (
            <div className="search-launch-bar">
              <button className="button button-primary" type="button" onClick={openSearchModal}><Search size={18} /> Buscar</button>
            </div>
          )}

          <FilterBar title={pageTitle} description={pageDescription} search={filters.search} city={filters.city} labelId={filters.labelId} cities={cities} labels={labels} categoryId={activeTarget === 'favorites' ? undefined : activeTarget} resultCount={filteredItems.length} supportsMap={supportsMap} viewMode={viewMode} onViewModeChange={setViewMode} onChange={(next) => setFilters((current) => ({ ...current, ...next }))} />

          {supportsMap && viewMode === 'map'
            ? <MapOverview items={filteredItems} onOpen={setSelectedItem} />
            : <RestaurantGrid items={filteredItems} labels={labels} hasAnyItems={sectionItems.length > 0} emptyTitle={activeTarget === 'favorites' ? 'Aún no tienes favoritos' : `Aún no has guardado nada en ${pageTitle}`} onOpen={setSelectedItem} onToggleFavorite={toggleFavorite} onAdd={openSearchModal} />}
        </div>
      </main>

      <footer className="app-footer"><span>Retiva · Todo lo que merece volver a encontrarse</span></footer>
      <BottomNavigation active={activeTarget} onChange={changeNavigation} />

      {searchOpen && (
        <div className="search-modal-backdrop" role="presentation" onMouseDown={closeSearchModal}>
          <section className="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-modal-heading">
              <h2 id="search-modal-title">Buscar y añadir</h2>
              <button className="icon-button" type="button" onClick={closeSearchModal} aria-label="Cerrar buscador"><X size={21} /></button>
            </div>
            <div className="command-center search-modal-content">
              <SearchPanel loading={loading} resetToken={searchResetToken} initialValue={modalSearchValue} onSearch={handleManualSearch} onImport={handleImport} onManualAdd={openManualAdd} />
              {manualPrefill && <ManualItemForm initialCategory={activeTarget === 'favorites' ? 'other' : activeTarget} initialTitle={manualPrefill.title} initialUrl={manualPrefill.url} labels={labels} onSave={handleManualContentSave} onClose={() => setManualPrefill(undefined)} />}
              {instagramImport && <ImportPanel instagram={instagramImport} instagramStage={instagramStage} importError={importError} detection={instagramDetection} labels={labels} onInstagramSearch={handleInstagramSearch} candidates={candidates} savingPlaceId={savingPlaceId} savedPlaceIds={placeIds} savedItems={items} onSaveCandidate={handleSaveInstagramCandidate} onOpenExisting={openExistingItem} onClearCandidates={clearCandidates} onClose={resetInstagramSession} />}
              {!instagramImport && <CandidateList candidates={candidates} savingPlaceId={savingPlaceId} savedPlaceIds={placeIds} savedItems={items} labels={labels} onSave={handleSaveCandidate} onOpenExisting={openExistingItem} onClear={clearCandidates} onWhatsApp={() => { setCandidates([]); setSearchResetToken((current) => current + 1); }} />}
            </div>
          </section>
        </div>
      )}

      {selectedItem && <RestaurantModal item={selectedItem} labels={labels} onClose={() => setSelectedItem(undefined)} onToggleFavorite={() => { toggleFavorite(selectedItem.id); setSelectedItem((current) => current ? { ...current, personal: { ...current.personal, favorite: !current.personal.favorite } } : current); }} onSave={(personal, categoryIds) => { updateItem(selectedItem.id, personal, categoryIds); setSelectedItem((current) => current ? { ...current, personal, categoryIds, categoryId: undefined } : current); setToast({ kind: 'success', message: 'Cambios guardados.' }); }} onDelete={() => { removeItem(selectedItem.id); setSelectedItem(undefined); setToast({ kind: 'success', message: 'Contenido eliminado.' }); }} />}

      {settingsOpen && <LabelManagerModal labels={labels} onClose={() => setSettingsOpen(false)} onCreate={(name, categoryId) => Boolean(createLabel(name, categoryId))} onUpdate={updateLabel} onDelete={deleteLabel} />}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}<span>{toast.message}</span><button type="button" onClick={() => setToast(undefined)} aria-label="Cerrar aviso"><X size={16} /></button></div>}
    </div>
  );
}

function mergeLabels(current: UserLabel[], imported: UserLabel[]): UserLabel[] {
  const byId = new Map(current.map((label) => [label.id, label]));
  for (const label of imported) {
    const existing = byId.get(label.id);
    if (!existing || Date.parse(label.updatedAt) > Date.parse(existing.updatedAt)) byId.set(label.id, label);
  }
  return [...byId.values()];
}

function titleFromUrl(value?: string): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./u, '');
  } catch {
    return '';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Se ha producido un error inesperado.';
}

export default App;
