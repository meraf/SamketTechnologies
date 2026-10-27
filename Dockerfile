FROM node:20-alpine
WORKDIR /app
COPY . .
ENV DATA_DIR=/data PORT=3000
VOLUME /data
CMD ["node","server.js"]
