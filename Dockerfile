FROM node:22 AS base
RUN apt-get update && apt-get install -y nftables iproute2 ncat

FROM base AS app-base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm i -g pnpm@10

FROM app-base AS build
COPY . /app
WORKDIR app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm deploy --filter=stun-ts-e2e /prod/e2e/stun-ts

FROM app-base AS e2e
COPY --from=build /prod/e2e/stun-ts /app
WORKDIR /app

CMD ["pnpm", "start"]
