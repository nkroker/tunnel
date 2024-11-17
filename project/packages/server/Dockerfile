FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package files
COPY packages/common/package.json ./packages/common/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install

# Copy source code
COPY packages/common/src ./packages/common/src
COPY packages/server/src ./packages/server/src
COPY packages/common/tsconfig.json ./packages/common/
COPY packages/server/tsconfig.json ./packages/server/

# Build packages
RUN pnpm -r build

EXPOSE 3000

CMD ["pnpm", "--filter", "@tunnel/server", "start"]
