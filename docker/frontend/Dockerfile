FROM node:lts

COPY build.sh /build.sh
COPY start_dev.sh /start_dev.sh
COPY start_prod.sh /start_prod.sh
RUN \
  chown node:node /build.sh && \
  chown node:node /start_dev.sh && \
  chown node:node /start_prod.sh

USER node

WORKDIR /frontend

CMD ["sh", "/start_prod.sh"]
