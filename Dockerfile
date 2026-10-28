FROM node:20-alpine AS b
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=b /app/dist ./dist
COPY server.js ./
COPY lib ./lib
ENV PORT=3000
CMD ["node","server.js"]
