# Build script for production
Write-Host "Building Azure DevOps Board Manager..."

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Host "Please edit .env file with your Azure DevOps credentials before running the application."
}

# Build and start the application
Write-Host "Building and starting Docker containers..."
docker-compose build
docker-compose up -d

Write-Host "Application started successfully!"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend API: http://localhost:8080"
Write-Host ""
Write-Host "To view logs: docker-compose logs -f"
Write-Host "To stop: docker-compose down"
