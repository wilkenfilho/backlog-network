# BACKLOG NETWORK — Rede Social Gamer

## 📁 Estrutura

```
backlog-network_final/
├── app/       → Projeto React Native (Expo) — o app
├── backend/   → API PHP + SQL para o Hostgator  
└── web/       → Páginas de privacidade e suporte
```

## 🚀 Testar GRÁTIS no PC

### 1. Instalar dependências
```bash
cd app
npm install
```

### 2. Rodar
```bash
npx expo start
```

### 3. Ver no celular
- Baixe **Expo Go** na App Store ou Play Store
- Escaneie o QR code que aparece no terminal
- App abre em segundos ✅

### Ver no navegador (alternativa)
```bash
npx expo start --web
```

## 🗄️ Backend
Veja `backend/LEIA_PRIMEIRO.txt` para instalar no Hostgator.

## 🔌 Conectar na API real
Em `src/services/api.ts` linha 10, troca:
```
'http://localhost:8000'
```
Por:
```
'https://wilkenperez.com/backlog-network-api'
```

## Custo pra testar: R$ 0
## Custo pra publicar (App Store): ~R$ 539/ano
