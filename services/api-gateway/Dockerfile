# ─────────────────────────────────────────────────────────────────────────────
# api-gateway — nginx reverse proxy for all upstream microservices.
# Uses stock nginx:alpine; configuration is mounted from ./nginx.conf.
# ─────────────────────────────────────────────────────────────────────────────

FROM nginx:1.27-alpine

# Remove default config + site
RUN rm /etc/nginx/conf.d/default.conf

# Inject our reverse-proxy config
COPY nginx.conf /etc/nginx/nginx.conf

# Lightweight healthcheck — hits the /health endpoint defined in nginx.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8001/health || exit 1

EXPOSE 8001

# nginx:alpine's CMD already runs nginx in foreground; nothing to override.