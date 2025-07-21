.PHONY: build dev stop clean logs help

# Default target
help:
	@echo "Azure DevOps Board Manager"
	@echo ""
	@echo "Available targets:"
	@echo "  build    - Build and start production containers"
	@echo "  dev      - Start development environment"
	@echo "  stop     - Stop all containers"
	@echo "  clean    - Stop and remove containers, networks, images"
	@echo "  logs     - Show container logs"
	@echo "  help     - Show this help message"

# Build and start production
build:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Please edit .env file with your Azure DevOps credentials."; \
	fi
	docker-compose build
	docker-compose up -d
	@echo ""
	@echo "Application started successfully!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:8080"

# Start development environment
dev:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Please edit .env file with your Azure DevOps credentials."; \
	fi
	docker-compose -f docker-compose.dev.yml up

# Stop containers
stop:
	docker-compose down
	docker-compose -f docker-compose.dev.yml down

# Clean up everything
clean:
	docker-compose down --rmi all --volumes --remove-orphans
	docker-compose -f docker-compose.dev.yml down --rmi all --volumes --remove-orphans

# Show logs
logs:
	docker-compose logs -f
