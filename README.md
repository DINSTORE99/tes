# SSH/VMess Shop - Dockerized Template

Cara cepat menjalankan (lokal):

1. Siapkan file `.env` dengan meng-copy `.env.example` dan mengisi provider API key.
2. Build image:
   ```
   docker build -t ssh-vmess-shop .
   ```
3. Jalankan container:
   ```
   docker run -d -p 3000:3000 --env-file .env --name ssh-vmess-shop ssh-vmess-shop
   ```
4. Atau gunakan docker-compose:
   ```
   docker-compose up -d --build
   ```
5. Buka http://localhost:3000

Catatan: ini template demo. Jangan gunakan API keys di repo publik. Gunakan DB produksi dan integrasikan gateway pembayaran nyata untuk penggunaan live.
