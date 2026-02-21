FROM node:20-alpine

RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN ./node_modules/.bin/tsc

RUN npm prune --omit=dev

EXPOSE 6901

USER node

CMD ["node", "dist/index.js"]
