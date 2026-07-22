FROM node:22-bookworm-slim AS base

# git is required at runtime for the activity/commit-log features (§6 of the spec)
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (bundled with Node 22) rather than a global npm install
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
