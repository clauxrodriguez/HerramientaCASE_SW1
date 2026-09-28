FROM node:20-alpine AS build

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=build /app/backend/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/backend/dist ./dist

EXPOSE 3001
CMD ["npm", "start"]
