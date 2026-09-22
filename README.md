# Kargo İşletme Sistemi

Bir kargo şirketinin elindeki kargoları uygun araçlara dağıtıp en kısa/en verimli rotadan taşınmasını sağlayarak maliyeti düşürmeyi amaçlayan bir lojistik yönetim sistemi.

## Problem

Kargo şirketleri için araç ve rota planlaması, doğru yapılmadığında ciddi maliyet artışına yol açar. Bu proje, kargoları uygun araçlara dağıtmayı ve en kısa yoldan taşınmasını otomatikleştirerek bu maliyeti azaltmayı hedefliyor.

## Yaklaşım

- **Rota optimizasyonu (`algorithms/`):** **A\* algoritması** kullanılarak, kargoların en kısa/en verimli rotadan taşınması hesaplanıyor
- **Backend (`controllers/`, `routes/`, `middleware/`):** Node.js + Express ile REST API
- **Veritabanı (`db/`):** MySQL, connection pool (`mysql2/promise`) üzerinden yönetiliyor
- **Frontend (`frontend/`):** Kullanıcı ve yönetici arayüzleri

**Roller ve özellikler:**
- **Yönetici:** Kargo aracı kiralayabilir veya iade edebilir, filoyu yönetir
- **Kullanıcı:** Kendi kargosunun hangi araçta, hangi rotadan geldiğini takip edebilir

## Teknolojiler

Node.js, Express, MySQL, A* algoritması

## Kurulum

```bash
npm install
```

`.env` dosyasına veritabanı bağlantı bilgilerini ekle:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=kargo_db
```

Sunucuyu başlat:
```bash
node server.js
```
