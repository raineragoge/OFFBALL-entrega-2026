# OFFBALL frontend · imagen de producción (build estático + nginx con proxy a la API)
#
#   docker build -t offball-frontend .
#   docker run --rm -p 5173:80 -e OFFBALL_API_UPSTREAM=http://host.docker.internal:8000 offball-frontend
#
# Por defecto el navegador habla con el MISMO ORIGEN (http://localhost:5173) y nginx
# reenvía /api/* y /health al backend: no hace falta CORS ni exponer el puerto 8000
# al navegador. OFFBALL_API_UPSTREAM se resuelve DESDE EL CONTENEDOR, nunca desde el navegador.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
COPY . .
# "" = mismo origen. Para llamar a la API directamente: --build-arg VITE_API_BASE_URL=https://api.midominio.com
ARG VITE_API_BASE_URL=
ARG VITE_API_TIMEOUT_MS=20000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS
RUN npm run verify

FROM nginx:1.27-alpine
ENV OFFBALL_API_UPSTREAM=http://host.docker.internal:8000
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
