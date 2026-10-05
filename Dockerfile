FROM node:22-bookworm-slim AS base

# git is required at runtime for the activity/commit-log features (§6 of the spec)
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Bind-mounted host repos are owned by the host user, not the container user,
# so git would refuse them as "dubious ownership" and activity would silently
# show "no git data". The mounts are read-only and allow-listed, so trust them.
RUN git config --system --add safe.directory '*'

# Enable pnpm via corepack (bundled with Node 22) rather than a global npm install
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
