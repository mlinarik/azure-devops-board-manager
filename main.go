package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

type WorkItem struct {
	ID     int                    `json:"id"`
	Fields map[string]interface{} `json:"fields"`
}

type LoginRequest struct {
	Organization string `json:"organization" binding:"required"`
	Project      string `json:"project" binding:"required"`
	PAT          string `json:"pat" binding:"required"`
}

type LoginResponse struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	Organization string `json:"organization,omitempty"`
	Project      string `json:"project,omitempty"`
	Token        string `json:"token,omitempty"`
}

type UserInfo struct {
	DisplayName string `json:"displayName"`
	EmailAddress string `json:"emailAddress"`
	ID          string `json:"id"`
}

type AreaPath struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	Children []AreaPath `json:"children,omitempty"`
}

type AreaPathResponse struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	Children []AreaPathResponse `json:"children,omitempty"`
}

type WorkItemsResponse struct {
	Value []WorkItem `json:"value"`
	Count int        `json:"count"`
}

type WorkItemUpdate struct {
	Op    string      `json:"op"`
	Path  string      `json:"path"`
	Value interface{} `json:"value"`
}

type WorkItemRelation struct {
	Rel        string                 `json:"rel"`
	URL        string                 `json:"url"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
}

type WorkItemWithRelations struct {
	ID        int                    `json:"id"`
	Fields    map[string]interface{} `json:"fields"`
	Relations []WorkItemRelation     `json:"relations,omitempty"`
}

type AzureDevOpsClient struct {
	Organization string
	Project      string
	PAT          string
	BaseURL      string
}

func NewAzureDevOpsClient(org, project, pat string) *AzureDevOpsClient {
	return &AzureDevOpsClient{
		Organization: org,
		Project:      project,
		PAT:          pat,
		BaseURL:      fmt.Sprintf("https://dev.azure.com/%s/%s/_apis", org, project),
	}
}

func (client *AzureDevOpsClient) makeRequest(method, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}

	// Properly encode PAT for Basic authentication
	auth := base64.StdEncoding.EncodeToString([]byte(":" + client.PAT))
	req.Header.Set("Authorization", "Basic "+auth)
	
	// Set appropriate content type based on request
	if method == "POST" && strings.Contains(url, "wiql") {
		req.Header.Set("Content-Type", "application/json")
	} else {
		req.Header.Set("Content-Type", "application/json-patch+json")
	}

	httpClient := &http.Client{}
	return httpClient.Do(req)
}

// ValidateCredentials tests if the PAT and project are valid
func (client *AzureDevOpsClient) ValidateCredentials() error {
	// Test connection by getting projects list (simpler than profile)
	projectsURL := fmt.Sprintf("https://dev.azure.com/%s/_apis/projects?api-version=6.0", client.Organization)
	resp, err := client.makeRequest("GET", projectsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to Azure DevOps: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("invalid Personal Access Token")
	}
	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("organization '%s' not found", client.Organization)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("authentication failed: %s", resp.Status)
	}

	// Test specific project access
	projectURL := fmt.Sprintf("https://dev.azure.com/%s/_apis/projects/%s?api-version=6.0", client.Organization, client.Project)
	resp, err = client.makeRequest("GET", projectURL, nil)
	if err != nil {
		return fmt.Errorf("failed to validate project access: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("project '%s' not found or access denied", client.Project)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("project validation failed: %s", resp.Status)
	}

	return nil
}

// GetUserInfo retrieves basic connection info (simplified)
func (client *AzureDevOpsClient) GetUserInfo() (*UserInfo, error) {
	// Just return basic info since profile API might not be accessible
	userInfo := &UserInfo{
		DisplayName:  "Azure DevOps User",
		EmailAddress: "",
		ID:          client.Organization,
	}
	return userInfo, nil
}

func (client *AzureDevOpsClient) GetWorkItems() ([]WorkItem, error) {
	// First get work item IDs using a WIQL query
	wiqlURL := fmt.Sprintf("%s/wit/wiql?api-version=6.0", client.BaseURL)
	wiqlQuery := map[string]string{
		"query": fmt.Sprintf("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '%s' AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Bug', 'Epic', 'Feature') ORDER BY [System.Id]", client.Project),
	}
	
	queryBody, _ := json.Marshal(wiqlQuery)
	resp, err := client.makeRequest("POST", wiqlURL, bytes.NewBuffer(queryBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get work items: %s", resp.Status)
	}

	var wiqlResult struct {
		WorkItems []struct {
			ID int `json:"id"`
		} `json:"workItems"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&wiqlResult); err != nil {
		return nil, err
	}

	if len(wiqlResult.WorkItems) == 0 {
		return []WorkItem{}, nil
	}

	// Get work item details
	var ids []string
	for _, wi := range wiqlResult.WorkItems {
		ids = append(ids, strconv.Itoa(wi.ID))
	}

	batchURL := fmt.Sprintf("%s/wit/workitems?ids=%s&$expand=all&api-version=6.0", client.BaseURL, strings.Join(ids, ","))
	
	resp, err = client.makeRequest("GET", batchURL, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get work item details: %s", resp.Status)
	}

	var result WorkItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Value, nil
}

func (client *AzureDevOpsClient) UpdateWorkItem(id int, updates []WorkItemUpdate) error {
	url := fmt.Sprintf("%s/wit/workitems/%d?api-version=6.0", client.BaseURL, id)
	
	body, err := json.Marshal(updates)
	if err != nil {
		return err
	}

	resp, err := client.makeRequest("PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to update work item: %s", resp.Status)
	}

	return nil
}

func (client *AzureDevOpsClient) CreateWorkItem(workItemType string, fields map[string]interface{}) (*WorkItem, error) {
	url := fmt.Sprintf("%s/wit/workitems/$%s?api-version=6.0", client.BaseURL, workItemType)
	
	var updates []WorkItemUpdate
	for field, value := range fields {
		updates = append(updates, WorkItemUpdate{
			Op:    "add",
			Path:  fmt.Sprintf("/fields/%s", field),
			Value: value,
		})
	}

	body, err := json.Marshal(updates)
	if err != nil {
		return nil, err
	}

	resp, err := client.makeRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to create work item: %s", resp.Status)
	}

	var workItem WorkItem
	if err := json.NewDecoder(resp.Body).Decode(&workItem); err != nil {
		return nil, err
	}

	return &workItem, nil
}

func (client *AzureDevOpsClient) GetAreaPaths() ([]AreaPathResponse, error) {
	url := fmt.Sprintf("%s/wit/classificationnodes/Areas?api-version=6.0&$depth=10", client.BaseURL)
	
	resp, err := client.makeRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get area paths: %s", resp.Status)
	}

	var response struct {
		Name     string `json:"name"`
		Path     string `json:"path"`
		Children []struct {
			Name     string `json:"name"`
			Path     string `json:"path"`
			Children []struct {
				Name string `json:"name"`
				Path string `json:"path"`
			} `json:"children,omitempty"`
		} `json:"children,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	// Convert to flattened list of area paths
	var areaPaths []AreaPathResponse
	
	// Add root area path
	areaPaths = append(areaPaths, AreaPathResponse{
		Name: response.Name,
		Path: response.Name,
	})

	// Add child area paths
	for _, child := range response.Children {
		childPath := response.Name + "\\" + child.Name
		areaPaths = append(areaPaths, AreaPathResponse{
			Name: child.Name,
			Path: childPath,
		})

		// Add grandchildren if any
		for _, grandchild := range child.Children {
			grandchildPath := childPath + "\\" + grandchild.Name
			areaPaths = append(areaPaths, AreaPathResponse{
				Name: grandchild.Name,
				Path: grandchildPath,
			})
		}
	}

	return areaPaths, nil
}

// GetWorkItemWithRelations retrieves a work item with its relationships
func (client *AzureDevOpsClient) GetWorkItemWithRelations(id int) (*WorkItemWithRelations, error) {
	url := fmt.Sprintf("%s/wit/workitems/%d?$expand=relations&api-version=6.0", client.BaseURL, id)
	
	resp, err := client.makeRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get work item: %s", resp.Status)
	}

	var workItem WorkItemWithRelations
	if err := json.NewDecoder(resp.Body).Decode(&workItem); err != nil {
		return nil, err
	}

	return &workItem, nil
}

// AddWorkItemRelation adds a parent-child relationship between work items
func (client *AzureDevOpsClient) AddWorkItemRelation(childId, parentId int, relType string) error {
	url := fmt.Sprintf("%s/wit/workitems/%d?api-version=6.0", client.BaseURL, childId)
	
	// Create the relationship URL for the parent
	parentUrl := fmt.Sprintf("https://dev.azure.com/%s/%s/_apis/wit/workitems/%d", client.Organization, client.Project, parentId)
	
	updates := []WorkItemUpdate{
		{
			Op:   "add",
			Path: "/relations/-",
			Value: WorkItemRelation{
				Rel: relType,
				URL: parentUrl,
			},
		},
	}

	body, err := json.Marshal(updates)
	if err != nil {
		return err
	}

	resp, err := client.makeRequest("PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to add work item relation: %s", resp.Status)
	}

	return nil
}

// RemoveWorkItemRelation removes a relationship between work items
func (client *AzureDevOpsClient) RemoveWorkItemRelation(workItemId int, relationIndex int) error {
	url := fmt.Sprintf("%s/wit/workitems/%d?api-version=6.0", client.BaseURL, workItemId)
	
	updates := []WorkItemUpdate{
		{
			Op:   "remove",
			Path: fmt.Sprintf("/relations/%d", relationIndex),
		},
	}

	body, err := json.Marshal(updates)
	if err != nil {
		return err
	}

	resp, err := client.makeRequest("PATCH", url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to remove work item relation: %s", resp.Status)
	}

	return nil
}

// Global variable to store authenticated clients
var clients = make(map[string]*AzureDevOpsClient)

// Simple token generation for session management
func generateToken(org, project string) string {
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s:%d", org, project, time.Now().Unix())))
}

// Get client from token
func getClientFromToken(token string) (*AzureDevOpsClient, error) {
	if client, exists := clients[token]; exists {
		return client, nil
	}
	return nil, fmt.Errorf("invalid or expired token")
}

func main() {
	// Load environment variables (fallback)
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	// Initialize Gin router
	r := gin.Default()

	// CORS middleware
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://frontend:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Auth-Token"}
	r.Use(cors.New(config))

	// Auth middleware
	authMiddleware := func(c *gin.Context) {
		token := c.GetHeader("X-Auth-Token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication token required"})
			c.Abort()
			return
		}

		client, err := getClientFromToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authentication token"})
			c.Abort()
			return
		}

		c.Set("client", client)
		c.Next()
	}

	// Public routes
	r.POST("/api/login", func(c *gin.Context) {
		var loginReq LoginRequest
		if err := c.ShouldBindJSON(&loginReq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		// Create client and validate credentials
		client := NewAzureDevOpsClient(loginReq.Organization, loginReq.Project, loginReq.PAT)
		if err := client.ValidateCredentials(); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		// Generate token and store client
		token := generateToken(loginReq.Organization, loginReq.Project)
		clients[token] = client

		// Get user info
		_, err := client.GetUserInfo()
		if err != nil {
			log.Printf("Warning: Could not get user info: %v", err)
		}

		response := LoginResponse{
			Success:      true,
			Message:      "Login successful",
			Organization: loginReq.Organization,
			Project:      loginReq.Project,
			Token:        token,
		}

		c.JSON(http.StatusOK, response)
	})

	// Protected routes
	api := r.Group("/api")
	api.Use(authMiddleware)
	{
		api.GET("/workitems", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			workItems, err := client.GetWorkItems()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, workItems)
		})

		api.GET("/areapaths", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			areaPaths, err := client.GetAreaPaths()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, areaPaths)
		})

		api.PATCH("/workitems/:id", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work item ID"})
				return
			}

			var updates []WorkItemUpdate
			if err := c.ShouldBindJSON(&updates); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			err = client.UpdateWorkItem(id, updates)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Work item updated successfully"})
		})

		api.POST("/workitems", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			var req struct {
				WorkItemType string                 `json:"workItemType"`
				Fields       map[string]interface{} `json:"fields"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			workItem, err := client.CreateWorkItem(req.WorkItemType, req.Fields)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, workItem)
		})

		// Get work item with relationships
		api.GET("/workitems/:id/relations", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			idStr := c.Param("id")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work item ID"})
				return
			}

			workItem, err := client.GetWorkItemWithRelations(id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, workItem)
		})

		// Add work item relationship
		api.POST("/workitems/:id/relations", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			idStr := c.Param("id")
			childId, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work item ID"})
				return
			}

			var req struct {
				ParentId int    `json:"parentId"`
				RelType  string `json:"relType"`
			}

			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			err = client.AddWorkItemRelation(childId, req.ParentId, req.RelType)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Relationship added successfully"})
		})

		// Remove work item relationship
		api.DELETE("/workitems/:id/relations/:index", func(c *gin.Context) {
			client := c.MustGet("client").(*AzureDevOpsClient)
			idStr := c.Param("id")
			indexStr := c.Param("index")

			workItemId, err := strconv.Atoi(idStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid work item ID"})
				return
			}

			relationIndex, err := strconv.Atoi(indexStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid relation index"})
				return
			}

			err = client.RemoveWorkItemRelation(workItemId, relationIndex)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "Relationship removed successfully"})
		})

		api.POST("/logout", func(c *gin.Context) {
			token := c.GetHeader("X-Auth-Token")
			delete(clients, token)
			c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
		})
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}
