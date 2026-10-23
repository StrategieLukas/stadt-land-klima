FROM node:22.23.4-alpine3.23 AS node-runtime
FROM directus/directus:11.17.4
ARG UID=1000
ARG GID=1000

ENV TEMP_PATH=/directus/.tmp

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh

RUN ln -s /directus/cli/index.mjs /directus/directus-cli

USER root
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

# Node patches its built-in fetch, but optional storage drivers carry another
# Undici copy. Keep that compatible 7.x dependency locked and patched as well.
COPY security-patches /opt/slk-directus-runtime-security
RUN npm ci --prefix /opt/slk-directus-runtime-security --ignore-scripts --no-audit --no-fund \
    && node /opt/slk-directus-runtime-security/patch-undici.ts \
    && node /opt/slk-directus-runtime-security/patch-api.ts

# install typst
RUN wget https://github.com/typst/typst/releases/download/v0.15.1/typst-x86_64-unknown-linux-musl.tar.xz \
    && echo "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c  typst-x86_64-unknown-linux-musl.tar.xz" | sha256sum -c - \
    && tar -xf typst-x86_64-unknown-linux-musl.tar.xz \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/ \
    && rm -rf typst-x86_64-unknown-linux-musl typst-x86_64-unknown-linux-musl.tar.xz


RUN apk upgrade --no-cache && apk add --no-cache bash shadow
RUN npm install --prefix /tmp/slk-npm --ignore-scripts --no-audit --no-fund npm@11.21.1 \
    && rm -rf /usr/local/lib/node_modules/npm \
    && mv /tmp/slk-npm/node_modules/npm /usr/local/lib/node_modules/npm \
    && rm -rf /tmp/slk-npm

RUN groupmod -g "${GID}" node && usermod -u "${UID}" -g "${GID}" node

RUN \
  mkdir -p /directus/.tmp && \
  chown node:node /directus/.tmp && \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

CMD ["sh", "/start_prod.sh"]
