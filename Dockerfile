FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --include=optional

COPY . .

RUN npm run build

CMD ["npm", "start"]