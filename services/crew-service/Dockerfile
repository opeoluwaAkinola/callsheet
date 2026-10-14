FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src src
USER node
EXPOSE 8082
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:8082/health/ready || exit 1
CMD ["node", "src/server.js"]
