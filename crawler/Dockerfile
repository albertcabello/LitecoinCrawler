FROM mhart/alpine-node:10.1.0

RUN apk --no-cache add --virtual native-deps \
    g++ gcc libgcc libstdc++ linux-headers make python git && \
    npm install --quiet node-gyp -g && \
    npm install --quiet

WORKDIR /app
RUN npm install -g nodemon
EXPOSE 3000 3000

COPY ./ /app/crawler/
RUN cd crawler && npm install && \
    mkdir -p /app/out/crawler && cp -r node_modules /app/out/crawler/

RUN apk del native-deps

WORKDIR /app/crawler
CMD npm run start
