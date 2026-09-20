# syntax=docker/dockerfile:1
FROM node:24.13.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public/ ./public/
COPY src/ ./src/
ENV VITE_API_URL="" \
    VITE_VOICE_AGENT_URL=/voice \
    VITE_PLATFORM=browser
RUN pnpm run build

FROM caddy:2.10.2-alpine AS runtime
RUN addgroup -g 10001 compass && adduser -D -u 10001 -G compass compass && \
    chown -R compass:compass /data /config && \
    setcap -r /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER compass
EXPOSE 80 443
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/healthz || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
