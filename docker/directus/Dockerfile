FROM directus/directus:10

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh
RUN ln -s /directus/cli/index.mjs /directus/directus-cli

USER root
RUN apk add bash

RUN groupmod -g "${GID}" node && usermod -u "${UID}" -g "${GID}" node

RUN \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

CMD ["sh", "/start_prod.sh"]
