FROM node:20-alpine

WORKDIR /app

# Install python and compilers for sandboxed bot execution
RUN apk add --no-cache python3 py3-pip bash curl

COPY package*.json ./

RUN npm ci --only=production

COPY . .

CMD ["node", "src/index.js"]
