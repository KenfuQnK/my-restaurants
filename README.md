# Mis Restaurantes

Aplicación web React/Vite con backend Express para buscar restaurantes en Google Places, guardarlos en el navegador y asociarles publicaciones originales de Instagram.

La aplicación no descarga ni almacena vídeos. Conserva la URL original, una URL normalizada y, cuando Meta lo permite, el HTML oficial de oEmbed utilizado únicamente para mostrar la publicación.

## Funcionalidad

- Búsqueda directa con Google Places API (New).
- Importación de enlaces completos o textos compartidos de Google Maps.
- Importación de publicaciones, Reels, vídeos y perfiles públicos de Instagram.
- Extracción de la primera URL válida de Instagram aunque el texto contenga otros enlaces.
- Normalización de URLs y eliminación de `igsh` y otros parámetros de seguimiento.
- Rechazo de dominios falsos y rutas no compatibles.
- Vista previa mediante Instagram oEmbed y fallback enlazado cuando no está disponible.
- Detección de varias cuentas: autor, menciones `@usuario`, colaboradores visibles en la descripción y URLs de perfil.
- Enriquecimiento opcional de cuentas profesionales mediante Business Discovery.
- Varias consultas explicadas y editables, con menor prioridad para perfiles que muestran señales de creador o recomendaciones.
- Búsqueda inicial conservadora y búsqueda manual editable en Google Places.
- Reintento del embed cuando el HTML oficial llega pero el iframe de Instagram no termina de montarse.
- Logs estructurados en la terminal de Vite/Express sin tokens, HTML ni URLs de CDN.
- Selección y confirmación explícita del restaurante antes de guardar.
- Varias publicaciones de Instagram asociadas al mismo `placeId`.
- Publicaciones incrustadas en la ficha del restaurante.
- Persistencia local compatible con los restaurantes guardados antes de esta función.

## Arquitectura

- `src/`: SPA React 19, componentes, hooks y persistencia en `localStorage`.
- `server/`: Express, Google Places, resolución de entradas compartidas e Instagram oEmbed.
- `POST /api/import/resolve`: identifica el tipo de entrada y genera una pista de búsqueda.
- `POST /api/instagram/resolve`: valida y normaliza la URL, consulta Meta y devuelve una respuesta segura y degradable.
- `POST /api/places/search`: busca candidatos reales.
- `GET /api/places/:placeId`: obtiene los detalles antes de guardar.

Google Places es la fuente maestra del restaurante. Instagram solo conserva la relación con el contenido original y nunca decide automáticamente qué restaurante es.

## Flujo de Instagram

1. Pulsa **Pegar enlace**.
2. Pega el enlace o todo el texto compartido.
3. La URL se valida en el navegador y nuevamente en el backend.
4. El backend consulta Graph oEmbed y, como enriquecimiento best-effort, la respuesta JSON oEmbed del host fijo `www.instagram.com`. No descarga la publicación.
5. Se muestra el embed oficial o un fallback.
6. Se extraen el autor y todas las cuentas mencionadas que Instagram haya incluido realmente en el JSON, además de las escritas o enlazadas por el usuario. Si Business Discovery está configurado, se consultan nombre, biografía, web y contadores públicos de cada perfil profesional.
7. Se generan pistas separadas y explicadas. Una cuenta con señales de creador o influencer no se trata automáticamente como restaurante.
8. Si no hay una pista suficiente, escribe manualmente el nombre y la ciudad.
9. Selecciona un candidato y pulsa **Guardar publicación**.
10. La relación aparece en **Publicaciones guardadas de Instagram** dentro de la ficha.

La URL proporcionada para validación:

```text
https://www.instagram.com/mintgranollers?igsh=MXVhZWNoNWwzbjhrZg==
```

se normaliza como:

```text
https://www.instagram.com/mintgranollers/
```

y genera la pista editable `mint granollers`. Es un perfil, no una publicación individual. Meta puede rechazar su embed si el perfil no admite inserciones; en ese caso la aplicación muestra el fallback, busca candidatos y permite guardar el enlace igualmente.

El Reel usado como segunda prueba:

```text
https://www.instagram.com/reel/DWeXll5DIsy/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==
```

se normaliza como `https://www.instagram.com/reel/DWeXll5DIsy/`. En la prueba real del 31 de julio de 2026 la aplicación obtuvo el autor `placesandfoodie`, la mención `hugosgaminglounge`, la descripción y el embed. Business Discovery devolvió `Hugo’s Gaming Lounge`; esa pista inició automáticamente Google Places y el primer resultado fue `Hugo’s Burgers and Videogames`, Carrer dels Almogàvers 4. La relación se guardó y el embed continuó funcionando después de recargar.

## Configuración en Windows

Requisitos:

- Windows 10 u 11.
- Node.js 22 o superior.
- Una clave de Google Places API (New) para datos reales.
- Para un uso fiable en producción, una app de Meta aprobada para **Meta oEmbed Read**.

Desde PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Completa las variables:

```env
GOOGLE_PLACES_API_KEY=tu_clave_de_google
META_GRAPH_API_VERSION=v26.0
META_OEMBED_ACCESS_TOKEN=tu_token_privado_de_meta
META_INSTAGRAM_USER_ACCESS_TOKEN=tu_token_de_usuario_con_permisos
META_INSTAGRAM_BUSINESS_ACCOUNT_ID=tu_id_numerico_de_instagram_profesional
INSTAGRAM_PUBLIC_OEMBED_ENRICHMENT=true
INSTAGRAM_DEBUG_LOGS=true
PORT=8787
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787
```

`META_OEMBED_ACCESS_TOKEN` puede dejarse vacío durante el desarrollo: actualmente el embed también puede llegar mediante la respuesta JSON de Instagram. Para una integración Graph soportada en producción, completa la aprobación y autenticación que Meta exija para **Meta oEmbed Read**. `META_INSTAGRAM_USER_ACCESS_TOKEN` es otro tipo de token y se usa únicamente para Business Discovery. Nunca uses el prefijo `VITE_` para claves o tokens, porque Vite los enviaría al navegador.

Arranca frontend y backend:

```powershell
npm run dev
```

Abre:

```text
http://127.0.0.1:5173
```

## Desplegar en Vercel

Importa el repositorio en Vercel como proyecto Vite. La configuraciÃ³n de `vercel.json` publica el frontend y dirige `/api/*` y `/share-target` a la funciÃ³n Express; no es necesario configurar una URL de API en el navegador. El build genera `dist-server` antes de empaquetar la funciÃ³n.

En **Settings > Environment Variables**, copia las variables privadas de `.env` que necesites (`GOOGLE_PLACES_API_KEY` y las de Meta). No aÃ±adas `PORT` ni variables con el prefijo `VITE_`. Para un dominio propio, aÃ±ade tambiÃ©n su origen a `CORS_ORIGINS`.

El desarrollo local no cambia: `npm run dev` sigue arrancando Vite y Express en los puertos 5173 y 8787.

## Configurar Google Places

1. Crea o selecciona un proyecto en Google Cloud.
2. Activa la facturación.
3. Activa **Places API (New)**.
4. Crea una API key.
5. Restringe la clave a Places API (New).
6. En producción, añade una restricción de aplicación apropiada para el servidor.
7. Guarda la clave únicamente como `GOOGLE_PLACES_API_KEY` en `.env`.

La clave se utiliza solo desde Express. Los candidatos muestran nombre, dirección, fotografía, puntuación y reseñas cuando Google devuelve esos campos.

## Configurar Meta oEmbed

La implementación se ha contrastado con la documentación oficial actual:

- [Instagram oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed)
- [Referencia de `instagram_oembed`](https://developers.facebook.com/docs/graph-api/reference/instagram-oembed/)
- [Meta oEmbed Read](https://developers.facebook.com/docs/features-reference/oembed-read/)
- [Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery)
- [Referencia de Business Discovery](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery)
- [Colaboradores de un contenido multimedia](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-media/collaborators)
- [Access Tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens)
- [Ayuda oficial sobre embeds](https://www.facebook.com/help/instagram/620154495870484)

Configuración recomendada para el embed:

1. Crea una app en Meta for Developers.
2. Completa la verificación empresarial requerida por Meta.
3. Solicita y supera App Review para **Meta oEmbed Read**.
4. Si el panel o la referencia de tu configuración exige token, obtén un **App Access Token** de esa misma app. No reutilices aquí por defecto un token de usuario de Instagram.
5. Guarda el token únicamente en `META_OEMBED_ACCESS_TOKEN`.
6. Mantén `META_GRAPH_API_VERSION=v26.0` o actualízala después de revisar la documentación y volver a ejecutar las pruebas.

El backend llama únicamente para presentar el contenido:

```text
GET https://graph.facebook.com/v26.0/instagram_oembed
```

con `url`, `omitscript=true` y `maxwidth=658`. Si existe token, se envía en la cabecera `Authorization`; nunca forma parte de la URL ni de los logs.

Para generar el App Access Token en PowerShell sin imprimir el secreto ni el token en pantalla:

```powershell
$metaAppId = Read-Host 'Meta App ID'
$metaAppSecretSecure = Read-Host 'Meta App Secret' -AsSecureString
$metaAppSecret = [System.Net.NetworkCredential]::new('', $metaAppSecretSecure).Password
$metaAppTokenResponse = Invoke-RestMethod -Method Post -Uri 'https://graph.facebook.com/oauth/access_token' -Body @{
  client_id = $metaAppId
  client_secret = $metaAppSecret
  grant_type = 'client_credentials'
}
$metaAppTokenResponse.access_token | Set-Clipboard
Remove-Variable metaAppSecret, metaAppSecretSecure, metaAppTokenResponse
```

Pega el valor del portapapeles en `META_OEMBED_ACCESS_TOKEN`. Es un secreto de servidor derivado del App Secret; no lo uses en una variable `VITE_` ni lo compartas.

### Token y Business Discovery

Una cuenta Instagram Business que ya utilizas para otra actividad sí puede actuar como cuenta de consulta; no necesita pertenecer al restaurante. El token existente solo es reutilizable si:

- fue emitido para la **misma app de Meta** que vas a configurar aquí;
- sigue vigente;
- pertenece al usuario que administra la cuenta profesional y su Página vinculada;
- incluye `instagram_basic`, `instagram_manage_insights` y `pages_read_engagement`;
- la app tiene el nivel de acceso y la revisión que Meta exige para tu modo de uso.

Un token de otra app, un App Access Token de oEmbed o un token sin esos permisos no sirve para Business Discovery.

Pasos desde el navegador en Windows:

1. Vincula tu cuenta Instagram Business o Creator a una Página de Facebook.
2. En Meta for Developers, abre la app que usará esta aplicación.
3. Abre **Tools > Graph API Explorer** y selecciona esa misma app.
4. Genera un **User Access Token** para el usuario administrador solicitando `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` y `pages_show_list`.
5. En Graph API Explorer consulta `GET /me/accounts?fields=name,instagram_business_account`.
6. Copia `instagram_business_account.id` en `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`.
7. Copia el User Access Token en `META_INSTAGRAM_USER_ACCESS_TOKEN`. Para producción, conviértelo al ciclo de vida recomendado por Meta y controla su caducidad; no lo pegues en el frontend ni lo confirmes en Git.
8. Reinicia `npm run dev`. La terminal debe mostrar `Instagram Business Discovery: configurado`.

Business Discovery solo acepta como destino cuentas Business o Creator y necesita conocer previamente su `username`. La app lo obtiene del autor, de las menciones incluidas por Instagram en la descripción, o del texto y URLs aportados por el usuario. Después consulta el endpoint oficial fijo de Graph API, nunca una URL arbitraria.

### Cambios vigentes de Meta

Meta retiró del endpoint Graph oEmbed documentado `author_name`, `author_url`, `thumbnail_url`, `thumbnail_width` y `thumbnail_height` en noviembre de 2025. La aplicación usa dos capas independientes:

- Graph `instagram_oembed` para el embed soportado por Meta.
- `https://www.instagram.com/api/v1/oembed/` como enriquecimiento JSON best-effort para el autor y la descripción que Instagram entregue realmente. Es un endpoint del dominio oficial, pero no está publicado como API estable para desarrolladores; puede cambiar. Se puede desactivar con `INSTAGRAM_PUBLIC_OEMBED_ENRICHMENT=false` sin romper el flujo manual.

En ambas capas:

- No se analiza el HTML para deducir cuentas: se usan únicamente campos JSON estructurados.
- No se inventa autor, descripción ni miniatura.
- No se persisten URLs temporales de CDN.
- Si el enriquecimiento no responde, permanecen el embed Graph, la URL original y la búsqueda manual.

La aplicación no usa la arista Graph `collaborators` para contenido ajeno, porque Meta restringe ese acceso. En publicaciones colaborativas detecta varias cuentas cuando aparecen como autor o mención en la respuesta JSON y las evalúa por separado. En el Reel de prueba esto permite distinguir a `placesandfoodie` de `hugosgaminglounge`.

No se admiten Stories. Las cuentas privadas, inactivas, con restricción de edad o con **Embeds** desactivado tampoco se pueden incrustar. El límite oficial documentado es de 1.000 solicitudes por hora.

## Seguridad y privacidad

- El backend nunca descarga la URL suministrada por el usuario.
- Solo llama a los hosts fijos `graph.facebook.com` y `www.instagram.com`; nunca realiza una petición a la URL arbitraria introducida por el usuario.
- Solo acepta `instagram.com`, `www.instagram.com` y `m.instagram.com` con rutas explícitas.
- No almacena vídeo, cookies, credenciales de Instagram ni URLs MP4.
- El token de Meta y la clave de Google permanecen en el backend.
- oEmbed se solicita con `omitscript=true`.
- El HTML se valida en backend y frontend.
- `dangerouslySetInnerHTML` está aislado en `InstagramEmbed` y solo recibe HTML oficial ya validado.
- `https://www.instagram.com/embed.js` se inserta una sola vez y después se llama a `instgrm.Embeds.process()`.
- `InstagramEmbed` está memoizado para que los cambios de búsqueda o selección no hagan que React restaure el `blockquote` y elimine el iframe que Instagram ya había montado.
- El componente observa si aparece el iframe, reprocesa una vez y ofrece **Reintentar embed** si Instagram no termina de cargarlo.
- Si cualquier validación falla, se muestra un enlace seguro al contenido original.

## Datos guardados

Cada restaurante mantiene:

- `external`: datos actuales de Google Places.
- `personal`: notas, etiquetas y favorito.
- `sources`: entradas desde las que se importó.
- `instagramPublications`: una lista de relaciones con Instagram.

Cada publicación guarda como mínimo:

```ts
{
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  shortcode?: string;
  publicationType?: "reel" | "post" | "unknown";
  authorName?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  embedHtml?: string;
  caption?: string;
  createdAt: string;
}
```

Los campos que Meta no devuelve quedan ausentes. La deduplicación de restaurantes usa `placeId` y la de publicaciones usa `normalizedUrl`.

## Pruebas

Ejecuta:

```powershell
npm test
```

La suite cubre normalización, extracción desde texto, Reels, posts, `igsh`, dominios falsos, rutas inválidas, oEmbed incompleto, contenido privado o eliminado, ausencia de autor, transformación de usuario, varias publicaciones, deduplicación y persistencia.

También cubre el Reel `DWeXll5DIsy`, extracción de autor y menciones desde JSON oEmbed, múltiples cuentas, separación de sugerencias, clasificación conservadora de cuentas de creador, fallback si el enriquecimiento falla, Business Discovery y envío de ambos tokens únicamente por cabecera.

## Logs de diagnóstico

Con `INSTAGRAM_DEBUG_LOGS=true`, la misma terminal de `npm run dev` muestra eventos como:

```text
[Instagram] url_parsed {"normalizedUrl":"...","publicationType":"reel","shortcode":"..."}
[Instagram] oembed_response {"status":200,"responseFields":["html","providerName","type"]}
[Instagram] public_oembed_response {"status":200,"authorName":"...","captionLength":865,"mentionedUsernames":["..."]}
[Instagram] business_discovery_result {"username":"...","status":"available",...}
[Instagram] resolution_complete {"embedStatus":"available","accounts":[...],"searchSuggestions":[...]}
[Instagram] places_search {"query":"...","resultCount":...}
```

No se registra el texto HTML del embed, tokens, claves de Google, miniaturas temporales ni contenido de vídeo.

Compila frontend y backend:

```powershell
npm run build
```

Prueba la versión compilada:

```powershell
npm start
```

Después abre:

```text
http://127.0.0.1:8787
```

## Limitaciones y futura recepción móvil

- Los datos siguen guardándose únicamente en el navegador actual.
- No hay login ni sincronización entre dispositivos.
- El proyecto es una aplicación web React/Vite; no se ha inventado soporte nativo para Android o iOS.
- La lógica de recepción está desacoplada detrás de `POST /api/instagram/resolve` y acepta texto compartido completo.
- Un futuro Android Share Intent, Web Share Target o iOS Share Extension solo tendrá que enviar ese texto al mismo flujo.
- La recepción nativa necesita un contenedor móvil/PWA y configuración específica de plataforma, que no forman parte de la arquitectura actual.
- El embed depende de la disponibilidad, permisos y límites de Instagram.
- Que un embed haya cargado una vez no garantiza que Instagram vaya a servir siempre su iframe: influyen privacidad, ajuste **Embeds**, eliminación, restricciones, límites, red y bloqueadores del navegador. El reintento cubre fallos de montaje de la app, no puede sustituir una respuesta denegada por Instagram.
- Cuando Meta no devuelve metadatos, la búsqueda manual es el comportamiento esperado.
