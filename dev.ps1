# Development script
Write-Host "Starting Azure DevOps Board Manager in development mode..."

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env file with your Azure DevOps credentials before running the application."
    Read-Host "Press Enter after updating .env file"
}

# Start development environment
Write-Host "Starting development containers..."
docker-compose -f docker-compose.dev.yml up

Write-Host "Development environment stopped."
