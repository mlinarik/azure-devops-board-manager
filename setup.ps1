# Setup script for users without Go installed locally
Write-Host "Setting up Azure DevOps Board Manager..."

# Check if Go is installed
try {
    $goVersion = go version
    Write-Host "Go is installed: $goVersion"
    
    # Run go mod tidy
    Write-Host "Downloading Go dependencies..."
    go mod tidy
    Write-Host "Dependencies downloaded successfully!"
} catch {
    Write-Host "Go is not installed locally, but that's okay!"
    Write-Host "The Docker containers will handle Go compilation."
}

# Create .env if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "IMPORTANT: Please edit .env file with your Azure DevOps credentials:"
    Write-Host "1. Set AZURE_DEVOPS_ORG to your organization name"
    Write-Host "2. Set AZURE_DEVOPS_PROJECT to your project name"
    Write-Host "3. Set AZURE_DEVOPS_PAT to your Personal Access Token"
    Write-Host ""
    Write-Host "To get a Personal Access Token:"
    Write-Host "1. Go to Azure DevOps -> User Settings -> Personal Access Tokens"
    Write-Host "2. Create new token with 'Work Items (read & write)' permissions"
    Write-Host "3. Copy the token to your .env file"
}

Write-Host ""
Write-Host "Setup complete! You can now run:"
Write-Host "  .\build.ps1     - for production"
Write-Host "  .\dev.ps1       - for development"
