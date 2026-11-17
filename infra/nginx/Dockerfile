# Stage 1: build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev
COPY frontend/ .

# Biến Auth0 cần bake vào lúc build (Vite đọc import.meta.env tại build time, không phải runtime)
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE

RUN npm run build

# Stage 2: Nginx phục vụ static files + API gateway
FROM nginx:1.27-alpine
COPY --from=frontend-build /app/dist /usr/share/nginx/html
# nginx.conf được mount qua volume trong docker-compose nên không cần COPY ở đây
