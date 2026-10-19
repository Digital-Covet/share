# CovetDrop (Share) image. One image, two processes:
#   web:    docker run covetdrop                      (node bin/server.js)
#   worker: docker run covetdrop node ace queue:work
# Migrations: docker run covetdrop node ace migration:run --connection=postgres_direct --force
# Configuration comes from env vars only (see docs/operations.md).

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.12.1

# --- Build: install all deps, compile TS and Vite assets into build/ --------
FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production deps only, installed inside build/ so the runtime stage copies
# one self-contained directory. pnpm-workspace.yaml carries the overrides
# the lockfile was resolved with.
WORKDIR /src/build
RUN cp ../pnpm-workspace.yaml . \
  && pnpm install --prod --frozen-lockfile

# --- Runtime: compiled app + prod node_modules, non-root ---------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3334 \
    TZ=UTC
WORKDIR /app

COPY --from=build --chown=node:node /src/build ./
RUN mkdir -p tmp && chown node:node tmp

USER node
EXPOSE 3334
CMD ["node", "bin/server.js"]
