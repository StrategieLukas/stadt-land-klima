FROM directus/directus:10
ARG UID=1000
ARG GID=1000

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh

RUN ln -s /directus/cli/index.mjs /directus/directus-cli

USER root

# install typst
RUN wget https://github.com/typst/typst/releases/download/v0.13.1/typst-x86_64-unknown-linux-musl.tar.xz \
    && tar -xf typst-x86_64-unknown-linux-musl.tar.xz \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/

    
RUN apk add bash shadow

RUN groupmod -g "${GID}" node && usermod -u "${UID}" -g "${GID}" node

RUN \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

CMD ["sh", "/start_prod.sh"]
