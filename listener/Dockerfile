FROM mhart/alpine-node:10.1.0

RUN apk --no-cache add --virtual native-deps \
    g++ gcc libgcc libstdc++ linux-headers make python git && \
    npm install --quiet node-gyp -g && \
    npm install --quiet

WORKDIR /app
RUN npm install -g nodemon
EXPOSE 9333 9333

COPY . /app/listener
RUN cd listener && npm install && \
    mkdir -p /app/out/listener && cp -r node_modules /app/out/listener

RUN apk del native-deps

WORKDIR /app/listener
CMD node listener.js

