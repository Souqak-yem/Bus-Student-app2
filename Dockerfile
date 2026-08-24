FROM node:22.12.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --include=optional

COPY . .

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

CMD ["npm", "start"]