ARG NODE_BASE_IMAGE
FROM ${NODE_BASE_IMAGE}
RUN apt-get update \
    && apt-get install -y --no-install-recommends git python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
USER node
