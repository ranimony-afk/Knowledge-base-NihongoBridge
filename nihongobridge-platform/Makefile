SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

COMPOSE := docker compose --project-directory $(CURDIR)

.PHONY: help dev down logs ps migrate seed etl test build sync-search setup clean

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "NihongoBridge platform commands:\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Start all local Docker services
	@test -f .env || cp .env.example .env
	$(COMPOSE) up -d --wait --wait-timeout 180 postgres redis meilisearch minio mailhog adminer
	$(COMPOSE) run --rm minio-init

down: ## Stop local services without deleting data
	$(COMPOSE) down

logs: ## Follow Docker service logs
	$(COMPOSE) logs --follow --tail=200

ps: ## Show Docker service health
	$(COMPOSE) ps

migrate: ## Apply knowledge, admin, and AI Drizzle migrations
	./scripts/run-migrations.sh

seed: ## Insert the idempotent N5 development fixture
	./scripts/run-seed.sh

etl: ## Run all ETL pipelines
	ETL_PIPELINES=$${ETL_PIPELINES:-all} ./scripts/run-etl.sh

test: ## Run platform, Node, Python, and Flutter tests
	./scripts/run-tests.sh

build: ## Build all Node services, ETL packages, and the mobile APK
	./scripts/run-builds.sh

sync-search: ## Configure and fully synchronize Meilisearch
	./scripts/sync-search.sh

setup: ## Run the one-command local setup
	./scripts/setup.sh

clean: ## Remove containers and named development volumes
	$(COMPOSE) down --volumes --remove-orphans
