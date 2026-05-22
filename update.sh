#!/bin/bash

# Script de Atualização automática via GitHub

echo "Atualizando código do repositório..."
git pull origin main

echo "Instalando dependências..."
npm install

echo "Compilando..."
npm run build

echo "Atualização concluída."
