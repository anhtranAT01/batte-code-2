FROM node:20-alpine

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache curl python3 make g++

COPY package*.json ./

RUN npm ci --only=production

COPY prisma ./prisma/
# Generate Prisma Client if prisma schema is present
RUN npx prisma generate || true

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
