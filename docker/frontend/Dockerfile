FROM node:24.22.1-trixie-slim
ARG UID=1000
ARG GID=1000

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh

USER root
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
RUN npm install --prefix /tmp/slk-npm --ignore-scripts --no-audit --no-fund npm@11.21.1 \
    && rm -rf /usr/local/lib/node_modules/npm \
    && mv /tmp/slk-npm/node_modules/npm /usr/local/lib/node_modules/npm \
    && rm -rf /tmp/slk-npm
RUN groupmod -g "${GID}" node && usermod -u "${UID}" -g "${GID}" node

RUN \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

WORKDIR /frontend

CMD ["sh", "/start_prod.sh"]
