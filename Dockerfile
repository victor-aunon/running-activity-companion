# syntax=docker/dockerfile:1

# 1. Base stage with Node and pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat

# 2. Dependencies installation stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-contracts/package.json ./packages/shared-contracts/
COPY apps/web-dashboard/package.json ./apps/web-dashboard/

RUN pnpm install --frozen-lockfile

# 3. Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-contracts/node_modules ./packages/shared-contracts/node_modules
COPY --from=deps /app/apps/web-dashboard/node_modules ./apps/web-dashboard/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-contracts ./packages/shared-contracts
COPY apps/web-dashboard ./apps/web-dashboard

ENV NODE_ENV=production
RUN pnpm --filter @running-support/shared-contracts build
RUN pnpm --filter web-dashboard build

# 4. Production Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user for container security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nodejs --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/packages/shared-contracts ./packages/shared-contracts
COPY --chown=nextjs:nodejs --from=builder /app/apps/web-dashboard ./apps/web-dashboard

USER nextjs
EXPOSE 3000

WORKDIR /app/apps/web-dashboard
CMD ["node", "--experimental-strip-types", "server.mjs"]
