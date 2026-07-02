FROM node:20-slim

# Install system dependencies for native builds and Chromium for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
# Now npm install should succeed with native modules compilation
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
RUN npm run build --if-present

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 12011
CMD ["npm", "run", "start"]
