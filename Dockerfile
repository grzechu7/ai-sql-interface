FROM node:20

# Katalog roboczy
WORKDIR /app

# Kopiujemy package.json i package-lock.json
COPY package*.json ./

# Instalujemy zależności
RUN npm install

# Kopiujemy resztę kodu
COPY . .

# Ustawiamy port
ENV PORT=8080
EXPOSE 8080

# Uruchamiamy aplikację
CMD ["node", "server.js"]
