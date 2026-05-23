#!/bin/bash

# Script de Instalação Interativa

echo "--- Configuração do Ambiente ---"
echo "A porta de rede deste servidor será fixada em 3000 devido à infraestrutura."

read -p "Email do Drive: " DRIVE_EMAIL
read -p "Chave API: " API_KEY
read -p "Domínio: " DOMAIN
read -p "Firebase Project ID: " FIREBASE_PROJECT_ID
read -p "Firebase Auth API Key: " FIREBASE_API_KEY

cat <<EOF > .env
DRIVE_EMAIL=$DRIVE_EMAIL
API_KEY=$API_KEY
DOMAIN=$DOMAIN
FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
FIREBASE_API_KEY=$FIREBASE_API_KEY
PORT=3000
EOF

echo "Configuração salva em .env!"
npm install
npm run build
