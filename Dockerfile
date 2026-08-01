FROM node:24.8-alpine

RUN addgroup -S -g 1024 javascript
RUN adduser -D -S -u 1024 -G javascript -h /opt/consuela javascript
RUN mkdir -p /opt/consuela/config
RUN chown -R javascript:javascript /opt/consuela

# Set the exposed stuff
VOLUME ["/opt/consuela/config"]
EXPOSE 8543

# install dependencies
WORKDIR /opt/consuela

COPY --chown=javascript:javascript .babelrc .
COPY --chown=javascript:javascript .eslintrc .
COPY --chown=javascript:javascript package.json .
COPY --chown=javascript:javascript yarn.lock .

USER javascript:javascript

RUN yarn install --frozen-lockfile && yarn cache clean

# Copy source
COPY --chown=javascript:javascript src ./src

# Build output
RUN yarn build

# Start it!
CMD ["node", "out/server.js"]
