# Despliegue — Stratex

Arquitectura de producción (segura, ~$5/mes):

```
Navegador → Cloudflare (DDoS/WAF/TLS) → Vercel (frontend, stratex.capital)
                                       → Railway (backend API, api.stratex.capital) → SQLite en disco persistente
```

## 1. Backend en Railway (api.stratex.capital)
- Proyecto nuevo → desplegar este repo (carpeta raíz del proyecto).
- **Start command:** `npm run server`
- **Volumen persistente:** montar en `/data` (para que la BD SQLite sobreviva a los redeploys).
- **Variables de entorno:**
  - `NODE_ENV=production`
  - `JWT_SECRET=` (cadena larga y aleatoria — genera con `openssl rand -hex 48`)
  - `CLIENT_ORIGIN=https://stratex.capital`
  - `STRATEX_DB_PATH=/data/stratex.db`
  - `PORT=4000` (Railway suele inyectar `PORT`; el server ya lo respeta)
- **Dominio:** añadir `api.stratex.capital` en Railway → te da un CNAME.

## 2. Frontend en Vercel (stratex.capital)
- Importar el repo. Framework: **Vite** (autodetectado). Build: `npm run build`, salida: `dist`.
- **Variables de entorno:**
  - `VITE_API_URL=https://api.stratex.capital/api`
- **Dominio:** añadir `stratex.capital` (y `www`) → Vercel te da el destino (CNAME/A).
- `vercel.json` ya incluye cabeceras de seguridad (CSP, HSTS, X-Frame-Options…) y el rewrite SPA.

## 3. DNS en Cloudflare
- `CNAME  @ (stratex.capital) → <destino de Vercel>`  · Proxy 🟠 ON
- `CNAME  api → <destino de Railway>`                 · Proxy 🟠 ON
- `CNAME  www → <destino de Vercel>`                  · Proxy 🟠 ON

## 4. Cloudflare — seguridad final (tras el deploy)
- **SSL/TLS → Overview → Full (strict)**.
- **Edge Certificates → HSTS → Enable** (una vez confirmado que carga por HTTPS).
- **Security → Security rules → Rate limiting:** 1 regla gratis, p. ej. limitar `POST /api/auth/*` a ~10/min por IP.

## 5. Checklist de seguridad post-deploy
- [ ] `JWT_SECRET` fuerte en Railway (no el de dev).
- [ ] Cambiar la contraseña del admin sembrado (`admin123`) por una fuerte.
- [ ] Confirmar que las credenciales demo NO aparecen en el login de producción.
- [ ] SSL en Full (strict) + HSTS activo.
- [ ] Regla de rate limiting en Cloudflare para auth.
- [ ] (Opcional) Turnstile real en registro/login (reemplazar el check simulado).

## Notas
- **BD:** hoy SQLite en volumen de Railway (privado, con backups del volumen). Migración futura a PostgreSQL (Neon/Supabase) es contenida: solo cambia `server/store.js`.
- **Sin GitHub:** puedes desplegar con los CLIs `vercel` y `railway up` desde la carpeta local; con GitHub obtienes backup + auto-deploy en cada commit (recomendado).
