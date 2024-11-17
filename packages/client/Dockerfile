FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package files
COPY packages/common/package.json ./packages/common/
COPY packages/client/package.json ./packages/client/

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/common/src ./packages/common/src
COPY packages/client/src ./packages/client/src
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/client/tsconfig.json ./packages/client/

# Build packages
RUN pnpm -r build

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pnpm --filter @tunnel/client exec node -e "process.exit(0)"

# Keep the container running
CMD ["pnpm", "--filter", "@tunnel/client", "start"]
