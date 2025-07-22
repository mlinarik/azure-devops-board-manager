"# Azure DevOps Board Manager

A Go-based application with React frontend for managing Azure DevOps backlog items.

## Features

- **Azure DevOps PAT Authentication** - Secure login with Personal Access Tokens
- **Area Path Management** - Hierarchical project organization with area path selection
- **Work Item Tagging** - Add and manage tags using Azure DevOps System.Tags field
- **Advanced Filtering** - Filter work items by area path and work item type
- **Complete Work Item Management** - View, create, edit work items (User Stories, Tasks, Bugs, etc.)
- **Work Item Type Selection** - Support for Epic, Feature, Task, Bug, Test Case, and more
- **Modern React Frontend** - Responsive design with professional Azure DevOps styling
- **Session Management** - Persistent authentication with secure token handling
- **Dockerized Deployment** - Easy deployment with multi-container setup

## Prerequisites

- Docker and Docker Compose
- Azure DevOps organization and project access
- Azure DevOps Personal Access Token (PAT) with appropriate permissions

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd azure-devops-board-manager
   ```

2. **Generate Personal Access Token**
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Create new token with the following permissions:
     - Work Items (read & write) - Required for work item management
     - Project and Team (read) - Required for area path retrieval
   - Copy the token for use during login

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open http://localhost:3000 in your browser
   - Login with your Azure DevOps organization name, project name, and PAT
   - Start managing your work items!

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

### Authentication
- `POST /api/login` - Authenticate with Azure DevOps PAT
- `POST /api/logout` - End user session

### Work Items
- `GET /api/workitems` - Get all work items (authenticated)
- `POST /api/workitems` - Create new work item (authenticated)
- `PATCH /api/workitems/:id` - Update work item (authenticated)

### Project Resources
- `GET /api/areapaths` - Get project area paths (authenticated)

### System
- `GET /health` - Health check (no authentication required)

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
