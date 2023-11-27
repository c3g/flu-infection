# Front end build stage
FROM node:20-bookworm-slim AS client-build

COPY client /client
WORKDIR /client

# Install dependencies & build the front end
RUN npm ci
RUN npm run build


# Final gateway setup using NGINX image
FROM nginx:1.25-bookworm

COPY data /data
COPY nginx-docker.conf /etc/nginx/nginx.conf
COPY --from=client-build /client/build /usr/share/nginx/html