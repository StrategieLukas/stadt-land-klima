FROM node:lts
ARG UID=1000
ARG GID=1000

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh

RUN groupmod -g "${GID}" node && usermod -u "${UID}" -g "${GID}" node

RUN \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

WORKDIR /frontend

CMD ["sh", "/start_prod.sh"]
