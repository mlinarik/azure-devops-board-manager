# Azure DevOps Setup Guide

This guide walks you through setting up your Azure DevOps environment to work with the Board Manager application.

## Prerequisites

- An Azure DevOps organization and project
- Access to create Personal Access Tokens (PATs)

## Step 1: Get Your Organization and Project Names

1. Go to your Azure DevOps homepage: `https://dev.azure.com`
2. Your URL will look like: `https://dev.azure.com/{organization}/{project}`
3. Note down your **organization** and **project** names

Example:
- Organization: `mycompany`
- Project: `myproject`

## Step 2: Create a Personal Access Token (PAT)

1. **Navigate to Personal Access Tokens**
   - Click on your profile picture (top right)
   - Select "Personal access tokens"
   - Or go directly to: `https://dev.azure.com/{organization}/_usersSettings/tokens`

2. **Create New Token**
   - Click "New Token"
   - Give it a name: `Board Manager App`
   - Set expiration (recommend 90 days or custom)

3. **Set Permissions**
   - **IMPORTANT**: Select "Custom defined" scopes
   - Under "Work Items", check:
     - ✅ **Read** - to view work items
     - ✅ **Write** - to create and update work items
   - Leave all other scopes unchecked

4. **Create and Copy Token**
   - Click "Create"
   - **IMPORTANT**: Copy the token immediately (you won't see it again)
   - Store it securely

## Step 3: Configure the Application

1. **Copy the environment file**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env file with your details**
   ```
   AZURE_DEVOPS_ORG=mycompany
   AZURE_DEVOPS_PROJECT=myproject
   AZURE_DEVOPS_PAT=your-generated-token-here
   ```

   Replace:
   - `mycompany` with your organization name
   - `myproject` with your project name  
   - `your-generated-token-here` with the PAT you generated

## Step 4: Test the Configuration

1. **Start the application**
   ```bash
   docker-compose up -d
   ```

2. **Check if it's working**
   - Open http://localhost:3000
   - You should see your work items loaded
   - If you see authentication errors, double-check your PAT and permissions

## Troubleshooting

### Common Issues

**"401 Unauthorized"**
- Check that your PAT is correct
- Verify the PAT hasn't expired
- Ensure you have Work Items (read & write) permissions

**"403 Forbidden"**
- Check that your organization and project names are correct
- Verify you have access to the project
- Make sure the PAT has the right scopes

**"No work items found"**
- This is normal if your project has no work items
- Try creating a work item through the Azure DevOps web interface first
- Check that work items exist in your project

### Supported Work Item Types

The application supports these work item types:
- User Story
- Product Backlog Item  
- Bug
- Task

### Supported States

The application supports these states:
- New
- Active
- Resolved
- Closed

*Note: Different Azure DevOps process templates (Agile, Scrum, CMMI) may have slightly different work item types and states.*

## Security Best Practices

1. **PAT Security**
   - Never commit your `.env` file to version control
   - Use minimum required permissions (only Work Items read/write)
   - Set reasonable expiration dates
   - Rotate tokens regularly

2. **Environment Variables**
   - The `.env` file is ignored by Git (see `.gitignore`)
   - In production, use secure environment variable management
   - Consider using Azure Key Vault for production deployments

## Advanced Configuration

### Custom Work Item Types

If your project uses custom work item types, you may need to modify the backend code:

1. Edit `main.go` in the `GetWorkItems` function
2. Update the WIQL query to include your custom types:
   ```go
   query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '%s' AND [System.WorkItemType] IN ('Your Custom Type', 'Another Type')"
   ```

### Custom Fields

To support custom fields:

1. Modify the frontend forms in `App.js`
2. Update the backend work item creation/update logic
3. Add field mappings in the API endpoints

For more advanced customizations, refer to the [Azure DevOps REST API documentation](https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items).
