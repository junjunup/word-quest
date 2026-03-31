FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY . .

# 安全：不以 root 运行
RUN chown -R node:node /app
USER node

EXPOSE 4000

CMD ["node", "src/app.js"]
