.PHONY: up down test smoke images lambda tf-validate

up: ## Run the whole stack at http://localhost:8080
	docker compose up --build -d --wait

down:
	docker compose down -v

test: ## Run every test suite
	cd services/scheduling-service && ./mvnw -B -q test
	cd services/crew-service && npm test
	cd services/gateway && npm test
	cd functions/callsheet-pdf && npm test
	cd web && npm test

smoke: ## End-to-end checks against a running stack
	./scripts/smoke-test.sh http://localhost:8080

images: ## Tag images for the local Kubernetes overlay
	docker build -t callsheet/scheduling-service:local services/scheduling-service
	docker build -t callsheet/crew-service:local services/crew-service
	docker build -t callsheet/gateway:local services/gateway
	docker build -t callsheet/web:local web

lambda: ## Build the Lambda bundle Terraform deploys
	cd functions/callsheet-pdf && npm ci && npm run build

tf-validate:
	cd infra/terraform && terraform fmt -check && terraform init -backend=false && terraform validate
