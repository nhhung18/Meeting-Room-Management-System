# Stage 1: build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev
COPY frontend/ .
RUN npm run build

# Stage 2: Nginx phục vụ static files + API gateway
FROM nginx:1.27-alpine
COPY --from=frontend-build /app/dist /usr/share/nginx/html
# nginx.conf được mount qua volume trong docker-compose nên không cần COPY ở đây
