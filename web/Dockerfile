# ---- dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build -----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# These are inlined into the client bundle at build time, so they must be set
# here and not only at runtime. docker-compose passes them as build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# HOSTNAME matters: the standalone server listens on $HOSTNAME, and Docker sets
# that to the container id - so without this it binds to the container's own
# name and nothing on 127.0.0.1 can reach it, including the healthcheck.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app

# `output: "standalone"` in next.config.ts produces this minimal server bundle.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# public/ must exist in the repo for this to resolve - see public/.gitkeep.
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# In the image rather than the stack file, so CI can verify it by running the
# container and waiting for it to report healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
