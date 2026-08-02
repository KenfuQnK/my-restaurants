# Criterio UX del proyecto

- La interfaz está dirigida a personas usuarias finales, no a desarrolladores.
- No mostrar tutoriales, explicaciones técnicas, estados internos, metadatos de análisis ni instrucciones innecesarias en la web.
- En una búsqueda deben aparecer directamente los sitios y las acciones relevantes.
- La información de depuración de Instagram, Google Places, tokens, cuentas detectadas y respuestas de servicios externos debe ir únicamente a los logs del backend.
- Mantener mensajes breves y funcionales solo cuando sean necesarios para completar una acción o corregir un error.
- Antes de dar por válida cualquier modificación, detener las instancias previas de este proyecto, iniciar obligatoriamente una única instancia con `_START.bat` y verificar el flujo afectado en `http://localhost:5175/` contra Vite y la API locales. Para cambios de búsqueda, probar expresamente una búsqueda de `MINT` en el navegador. No sustituir esta comprobación por una compilación, pruebas unitarias o un despliegue remoto.
