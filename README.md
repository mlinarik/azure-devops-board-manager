"# Azure DevOps Board Manager

A Go-based application with React frontend for managing Azure DevOps backlog items.

## Features

- View Azure DevOps work items (User Stories, Product Backlog Items, Bugs, Tasks)
- Create new work items
- Edit existing work items (title, description, state)
- Modern React frontend with responsive design
- Dockerized for easy deployment

## Prerequisites

- Docker and Docker Compose
- Azure DevOps Personal Access Token (PAT) with Work Items (read & write) permissions

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd azure-devops-board-manager
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your Azure DevOps details:
   ```
   AZURE_DEVOPS_ORG=your-organization
   AZURE_DEVOPS_PROJECT=your-project
   AZURE_DEVOPS_PAT=your-personal-access-token
   ```

3. **Generate Personal Access Token**
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Create new token with "Work Items" read & write permissions
   - Copy the token to your `.env` file

## Running the Application

### Production Mode
```bash
docker-compose up -d
```

### Development Mode
```bash
docker-compose -f docker-compose.dev.yml up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

## API Endpoints

- `GET /api/workitems` - Get all work items
- `POST /api/workitems` - Create new work item
- `PATCH /api/workitems/:id` - Update work item
- `GET /health` - Health check

## Architecture

### Backend (Go)
- **Framework**: Gin (HTTP router)
- **Features**: 
  - Azure DevOps REST API integration
  - CORS support for frontend communication
  - Environment-based configuration
  - JSON patch operations for updates

### Frontend (React)
- **Framework**: React 18
- **Features**:
  - Responsive grid layout for work items
  - Modal dialogs for create/edit operations
  - Real-time state management
  - Error handling and loading states

### Docker
- Multi-stage builds for optimized images
- Separate containers for frontend and backend
- Development and production configurations
- Network isolation and service discovery

## Work Item Types Supported

- User Story
- Product Backlog Item
- Bug
- Task

## States Supported

- New
- Active
- Resolved
- Closed

## Development

### Backend Development
```bash
# Install dependencies
go mod download

# Run locally
go run main.go
```

### Frontend Development
```bash
cd frontend
npm install
npm start
```

## Troubleshooting

1. **Authentication Issues**
   - Verify PAT has correct permissions
   - Check organization and project names
   - Ensure PAT hasn't expired

2. **Connection Issues**
   - Verify network connectivity to Azure DevOps
   - Check firewall settings
   - Validate environment variables

3. **Docker Issues**
   - Ensure Docker daemon is running
   - Check port availability (3000, 8080)
   - Review container logs: `docker-compose logs`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License." 
