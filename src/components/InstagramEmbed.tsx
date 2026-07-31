import { CameraOff, ExternalLink, LoaderCircle, RotateCw } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  isTrustedInstagramEmbedHtml,
  processInstagramEmbeds,
} from '../services/instagram';
import type { InstagramPublication } from '../types/restaurant';

interface InstagramEmbedProps {
  publication: InstagramPublication;
  compact?: boolean;
}

export const InstagramEmbed = memo(function InstagramEmbed({
  publication,
  compact = false,
}: InstagramEmbedProps) {
  const [attempt, setAttempt] = useState(0);
  const [embedState, setEmbedState] = useState<'idle' | 'processing' | 'ready' | 'failed'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const trustedHtml = useMemo(
    () =>
      isTrustedInstagramEmbedHtml(publication.embedHtml, publication.normalizedUrl)
        ? publication.embedHtml
        : undefined,
    [publication.embedHtml, publication.normalizedUrl],
  );

  useEffect(() => {
    if (!trustedHtml) {
      setEmbedState('idle');
      return;
    }

    let active = true;
    const timers: number[] = [];
    const hasRenderedEmbed = () =>
      Boolean(
        containerRef.current?.querySelector(
          'iframe, blockquote.instagram-media-rendered',
        ),
      );
    const markReady = () => {
      if (active && hasRenderedEmbed()) setEmbedState('ready');
    };
    const observer = new MutationObserver(markReady);
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    setEmbedState('processing');
    void processInstagramEmbeds()
      .then(() => {
        if (!active) return;
        markReady();
        timers.push(
          window.setTimeout(() => {
            if (!active || hasRenderedEmbed()) return;
            void processInstagramEmbeds().then(markReady).catch(() => undefined);
          }, 700),
          window.setTimeout(() => {
            if (!active || hasRenderedEmbed()) return;
            setEmbedState('failed');
          }, 8_000),
        );
      })
      .catch(() => {
        if (active) setEmbedState('failed');
      });

    return () => {
      active = false;
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [attempt, publication.id, trustedHtml]);

  return (
    <article className={`instagram-publication ${compact ? 'compact' : ''}`}>
      {trustedHtml ? (
        <div
          key={`${publication.id}-${attempt}`}
          ref={containerRef}
          className="instagram-embed-html"
          /*
           * El único HTML insertado procede del endpoint oficial de Meta, solicitado
           * por el backend con omitscript=true, validado allí y comprobado de nuevo
           * aquí. El script se carga por separado una sola vez.
           */
          dangerouslySetInnerHTML={{ __html: trustedHtml }}
        />
      ) : (
        <div className="instagram-fallback">
          <span aria-hidden="true"><CameraOff size={24} /></span>
          <strong>Vista previa no disponible</strong>
          <p>
            La publicación puede ser privada, haberse eliminado o tener desactivada
            la inserción. El enlace original sigue guardado.
          </p>
        </div>
      )}

      {trustedHtml && embedState === 'processing' && (
        <div className="instagram-embed-runtime-status" role="status">
          <LoaderCircle className="spin" size={15} /> Instagram está preparando la vista…
        </div>
      )}

      {trustedHtml && embedState === 'failed' && (
        <div className="instagram-embed-runtime-status warning" role="status">
          <span>El HTML oficial llegó, pero Instagram no terminó de cargar el iframe.</span>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            <RotateCw size={14} /> Reintentar embed
          </button>
        </div>
      )}

      <div className="instagram-publication-footer">
        <div>
          <strong>
            {publication.publicationType === 'reel'
              ? 'Reel de Instagram'
              : publication.publicationType === 'post'
                ? 'Publicación de Instagram'
                : 'Contenido de Instagram'}
          </strong>
          {publication.authorName && <span>@{publication.authorName.replace(/^@/, '')}</span>}
        </div>
        <div className="instagram-publication-actions">
          {trustedHtml && embedState === 'ready' && (
            <button type="button" onClick={() => setAttempt((current) => current + 1)}>
              <RotateCw size={14} /> Recargar
            </button>
          )}
          <a
            href={publication.normalizedUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Abrir en Instagram <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </article>
  );
});
