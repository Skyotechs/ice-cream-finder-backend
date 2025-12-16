FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npx", "tsx", "start.ts"]