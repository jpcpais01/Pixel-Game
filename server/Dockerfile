# The online play server as a container (Fly.io, or any Docker host).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
