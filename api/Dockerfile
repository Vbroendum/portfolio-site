# ---- build -----------------------------------------------------------------
FROM golang:1.26-alpine AS build

WORKDIR /src

# Dependencies first so they stay cached across source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO off => a static binary that runs on the distroless/alpine runtime below.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server && \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/adminctl ./cmd/adminctl

# ---- runtime ---------------------------------------------------------------
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata wget && \
    adduser -D -u 10001 app

COPY --from=build /out/server /usr/local/bin/server
COPY --from=build /out/adminctl /usr/local/bin/adminctl

# Uploads live here; docker-compose mounts a volume over it.
RUN mkdir -p /data/uploads && chown -R app:app /data

USER app
WORKDIR /data

ENV API_ADDR=:8080 \
    STORAGE_LOCAL_DIR=/data/uploads

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["server"]
