# suilens-microservice-tutorial

Microservices tutorial implementation for Assignment 1 Part 2.2.

## Run

```bash
docker compose up --build -d
```

## Migrate + Seed (from host)

```bash
(cd services/catalog-service && bun install --frozen-lockfile && bunx drizzle-kit push)
(cd services/order-service && bun install --frozen-lockfile && bunx drizzle-kit push)
(cd services/notification-service && bun install --frozen-lockfile && bunx drizzle-kit push)
(cd services/catalog-service && bun run src/db/seed.ts)
```

## Smoke Test

```bash
curl http://localhost:3001/api/lenses | jq
LENS_ID=$(curl -s http://localhost:3001/api/lenses | jq -r '.[0].id')

curl -X POST http://localhost:3002/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Budi Santoso",
    "customerEmail": "budi@example.com",
    "lensId": "'"$LENS_ID"'",
    "startDate": "2025-03-01",
    "endDate": "2025-03-05"
  }' | jq

docker compose logs notification-service --tail 20
```

## Stop

```bash
docker compose down
```

## Kubernetes

Build lalu push image ke Docker Hub:

```bash
docker login
docker build -t YOUR_DOCKERHUB_USERNAME/suilens-catalog-service:latest ./services/catalog-service
docker build -t YOUR_DOCKERHUB_USERNAME/suilens-order-service:latest ./services/order-service
docker build -t YOUR_DOCKERHUB_USERNAME/suilens-notification-service:latest ./services/notification-service
docker build -t YOUR_DOCKERHUB_USERNAME/suilens-frontend:latest ./frontend/suilens-frontend
docker push YOUR_DOCKERHUB_USERNAME/suilens-catalog-service:latest
docker push YOUR_DOCKERHUB_USERNAME/suilens-order-service:latest
docker push YOUR_DOCKERHUB_USERNAME/suilens-notification-service:latest
docker push YOUR_DOCKERHUB_USERNAME/suilens-frontend:latest
```

Deploy seluruh manifest:

```bash
kubectl apply -f k8s.yml
```

Cek pod:

```bash
kubectl get pods -o wide -n suilens-2306245106
```

Akses aplikasi:

```bash
kubectl get svc -n suilens-2306245106
```

NodePort yang dipakai:

- Frontend: `30000`
- Catalog API: `30001`
- Order API: `30002`
- Notification API / WebSocket: `30003`

URL yang bisa dicek dari host:

- Frontend: `http://192.168.56.101:30000`
- Catalog docs: `http://192.168.56.101:30001/docs`
- Order docs: `http://192.168.56.101:30002/docs`
- Notification health: `http://192.168.56.101:30003/health`

Jika ingin menjalankan seed katalog ulang:

```bash
kubectl delete job catalog-seed -n suilens-2306245106 --ignore-not-found
kubectl apply -f k8s.yml
```
