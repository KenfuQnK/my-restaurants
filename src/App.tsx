import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { CandidateList } from './components/CandidateList';
import { FilterBar } from './components/FilterBar';
import { ImportPanel } from './components/ImportPanel';
import { MapOverview } from './components/MapOverview';
import { RestaurantGrid } from './components/RestaurantGrid';
import { RestaurantModal } from './components/RestaurantModal';
import { SearchPanel } from './components/SearchPanel';
import { useRestaurants } from './hooks/useRestaurants';
import { api } from './services/api';
import type {
  ExternalPlace,
  ImportSource,
  InstagramImportStage,
  ResolvedInstagramPublication,
  SavedRestaurant,
  SearchLocation,
} from './types/restaurant';
import { humanizeType } from './utils/formatters';

interface ToastState {
  kind: 'success' | 'error';
  message: string;
}

function App() {
  const {
    restaurants,
    placeIds,
    addRestaurant,
    updatePersonalData,
    toggleFavorite,
    removeRestaurant,
  } = useRestaurants();

  const [candidates, setCandidates] = useState<ExternalPlace[]>([]);
  const [instagramImport, setInstagramImport] =
    useState<ResolvedInstagramPublication>();
  const [instagramStage, setInstagramStage] =
    useState<InstagramImportStage>('waiting');
  const [importError, setImportError] = useState<string>();
  const [pendingSource, setPendingSource] = useState<ImportSource>();
  const [selectedRestaurant, setSelectedRestaurant] = useState<SavedRestaurant>();
  const [loading, setLoading] = useState(false);
  const [savingPlaceId, setSavingPlaceId] = useState<string>();
  const [toast, setToast] = useState<ToastState>();
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    category: '',
    favoritesOnly: false,
  });

  const addSectionRef = useRef<HTMLElement>(null);
  const sharedInputHandledRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 4_500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (sharedInputHandledRef.current) return;

    const sharedInput = new URLSearchParams(window.location.search).get('share_url')?.trim();
    if (!sharedInput) return;

    sharedInputHandledRef.current = true;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('share_url');
    window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    void handleImport(sharedInput);
  }, []);

  const cities = useMemo(
    () =>
      Array.from(
        new Set(restaurants.map((item) => item.external.city).filter((item): item is string => Boolean(item))),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [restaurants],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          restaurants
            .map((item) => item.external.primaryTypeLabel ?? humanizeType(item.external.primaryType))
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [restaurants],
  );

  const filteredRestaurants = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLocaleLowerCase('es');

    return restaurants
      .filter((item) => {
        const category = item.external.primaryTypeLabel ?? humanizeType(item.external.primaryType);
        const haystack = [
          item.external.name,
          item.external.address,
          item.external.city,
          item.personal.notes,
          ...item.personal.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('es');

        return (
          (!normalizedSearch || haystack.includes(normalizedSearch)) &&
          (!filters.city || item.external.city === filters.city) &&
          (!filters.category || category === filters.category) &&
          (!filters.favoritesOnly || item.personal.favorite)
        );
      })
      .sort((a, b) => {
        if (a.personal.favorite !== b.personal.favorite) return a.personal.favorite ? -1 : 1;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [filters, restaurants]);

  async function runSearch(
    query: string,
    source: ImportSource,
    searchLocation?: SearchLocation,
    instagramFlow = false,
  ) {
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
        const message =
          'No se han encontrado restaurantes. Prueba con el nombre y la ciudad.';
        if (instagramFlow) {
          setInstagramStage('awaiting_search');
          setImportError(message);
        }
        setToast({ kind: 'error', message });
      } else {
        if (instagramFlow) setInstagramStage('candidates');
      }
    } catch (error) {
      setCandidates([]);
      const message = getErrorMessage(error);
      if (instagramFlow) {
        setInstagramStage('awaiting_search');
        setImportError(`Google Places: ${message}`);
      }
      setToast({ kind: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  function handleManualSearch(query: string) {
    resetInstagramSession();
    void runSearch(query, {
      kind: 'manual_search',
      originalInput: query,
      importedAt: new Date().toISOString(),
    });
  }

  async function handleImport(input: string) {
    setLoading(true);
    setCandidates([]);
    setInstagramImport(undefined);
    setInstagramStage('validating');
    setImportError(undefined);
    try {
      const resolved = await api.resolveImport(input);

      if (resolved.source === 'instagram') {
        setInstagramStage('resolving');
        const instagram = await api.resolveInstagram(input);
        setInstagramImport(instagram);

        const source: ImportSource = {
          kind: 'instagram',
          originalInput: input,
          url: instagram.publication.originalUrl,
          importedAt: new Date().toISOString(),
        };
        setPendingSource(source);

        if (!instagram.suggestedQuery) {
          setInstagramStage('awaiting_search');
          setImportError(
            'Instagram no ha proporcionado un nombre fiable. Escribe el restaurante para buscarlo.',
          );
          return;
        }

        setLoading(false);
        await runSearch(instagram.suggestedQuery, source, undefined, true);
        return;
      }

      setInstagramStage('waiting');
      if (!resolved.query) {
        setToast({ kind: 'error', message: resolved.explanation });
        return;
      }

      const source: ImportSource = {
        kind: resolved.source,
        originalInput: resolved.originalInput,
        url: resolved.url,
        importedAt: new Date().toISOString(),
      };

      setLoading(false);
      await runSearch(resolved.query, source, resolved.coordinates);
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
    const source: ImportSource = pendingSource ?? {
      kind: 'instagram',
      originalInput: instagramImport.publication.originalUrl,
      url: instagramImport.publication.originalUrl,
      importedAt: new Date().toISOString(),
    };
    void runSearch(query, source, undefined, true);
  }

  async function handleSaveCandidate(candidate: ExternalPlace) {
    setSavingPlaceId(candidate.placeId);
    const wasAlreadySaved = placeIds.has(candidate.placeId);
    try {
      const details = await api.getPlaceDetails(candidate.placeId);
      const source: ImportSource = pendingSource ?? {
        kind: 'manual_search',
        importedAt: new Date().toISOString(),
      };
      const result = addRestaurant(details, source);
      setSelectedRestaurant(result.restaurant);
      setToast({
        kind: 'success',
        message: wasAlreadySaved ? 'Restaurante actualizado.' : 'Restaurante guardado en tu colección.',
      });
    } catch (error) {
      setToast({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setSavingPlaceId(undefined);
    }
  }

  async function handleSaveInstagramCandidate(candidate: ExternalPlace) {
    if (!instagramImport) return;

    setSavingPlaceId(candidate.placeId);
    try {
      const details = await api.getPlaceDetails(candidate.placeId);
      const source: ImportSource = pendingSource ?? {
        kind: 'instagram',
        originalInput: instagramImport.publication.originalUrl,
        url: instagramImport.publication.originalUrl,
        importedAt: new Date().toISOString(),
      };
      const result = addRestaurant(
        details,
        source,
        instagramImport.publication,
      );

      setSelectedRestaurant(result.restaurant);
      setCandidates([]);
      setInstagramStage('saved');
      setImportError(undefined);
      setToast({
        kind: 'success',
        message: result.publicationAdded
          ? 'Publicación asociada al restaurante.'
          : 'La publicación ya estaba asociada; se ha actualizado el restaurante.',
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setImportError(`No se ha podido guardar: ${message}`);
      setToast({ kind: 'error', message });
    } finally {
      setSavingPlaceId(undefined);
    }
  }

  function clearCandidates() {
    setCandidates([]);
    if (instagramImport && instagramStage !== 'saved') {
      setInstagramStage('awaiting_search');
    }
  }

  function resetInstagramSession() {
    setInstagramImport(undefined);
    setInstagramStage('waiting');
    setImportError(undefined);
    setCandidates([]);
  }

  function openAddSection() {
    addSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('restaurant-search')?.focus(), 350);
  }

  function closeModal() {
    setSelectedRestaurant(undefined);
  }

  return (
    <div id="top" className="app-shell">
      <AppHeader count={restaurants.length} onFocusAdd={openAddSection} />

      <main className="workspace">
        <div className="content-container">
          <section className="command-center" ref={addSectionRef}>
            <div className="command-heading">
              <h1>¿Dónde comemos hoy?</h1>
            </div>
            <SearchPanel
              loading={loading}
              onSearch={handleManualSearch}
              onImport={handleImport}
            />

            {instagramImport && (
              <ImportPanel
                instagram={instagramImport}
                instagramStage={instagramStage}
                importError={importError}
                onInstagramSearch={handleInstagramSearch}
                candidates={candidates}
                savingPlaceId={savingPlaceId}
                savedPlaceIds={placeIds}
                onSaveCandidate={handleSaveInstagramCandidate}
                onClearCandidates={clearCandidates}
                onClose={resetInstagramSession}
              />
            )}

            {!instagramImport && (
              <CandidateList
                candidates={candidates}
                savingPlaceId={savingPlaceId}
                savedPlaceIds={placeIds}
                onSave={handleSaveCandidate}
                onClear={clearCandidates}
              />
            )}
          </section>

          <MapOverview restaurants={filteredRestaurants} onOpen={setSelectedRestaurant} />

          <FilterBar
            {...filters}
            cities={cities}
            categories={categories}
            resultCount={filteredRestaurants.length}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          />

          <RestaurantGrid
            restaurants={filteredRestaurants}
            hasAnyRestaurants={restaurants.length > 0}
            onOpen={setSelectedRestaurant}
            onToggleFavorite={toggleFavorite}
            onAdd={openAddSection}
          />
        </div>
      </main>

      <footer className="app-footer">
        <span>Mis Restaurantes · Tu colección privada</span>
      </footer>

      {selectedRestaurant && (
        <RestaurantModal
          restaurant={selectedRestaurant}
          onClose={closeModal}
          onToggleFavorite={() => {
            toggleFavorite(selectedRestaurant.id);
            setSelectedRestaurant((current) =>
              current
                ? { ...current, personal: { ...current.personal, favorite: !current.personal.favorite } }
                : current,
            );
          }}
          onSavePersonal={(personal) => {
            updatePersonalData(selectedRestaurant.id, personal);
            setSelectedRestaurant((current) => (current ? { ...current, personal } : current));
            setToast({ kind: 'success', message: 'Notas y etiquetas actualizadas.' });
          }}
          onDelete={() => {
            removeRestaurant(selectedRestaurant.id);
            closeModal();
            setToast({ kind: 'success', message: 'Restaurante eliminado.' });
          }}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.kind === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(undefined)} aria-label="Cerrar aviso"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Se ha producido un error inesperado.';
}

export default App;
