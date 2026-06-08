FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
# Disable postinstall script that might rely on db connection, but we need prisma generate
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy root workspace and lockfile
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy API package
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built code
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Copy generated prisma client
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3001

CMD ["pnpm", "--filter", "api", "start"]
