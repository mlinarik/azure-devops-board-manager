package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

type WorkItem struct {
	ID     int                    `json:"id"`
	Fields map[string]interface{} `json:"fields"`
	URL    string                 `json:"url"`
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

	req.Header.Set("Authorization", "Basic "+client.PAT)
	req.Header.Set("Content-Type", "application/json-patch+json")

	httpClient := &http.Client{}
	return httpClient.Do(req)
}

func (client *AzureDevOpsClient) GetWorkItems() ([]WorkItem, error) {
	url := fmt.Sprintf("%s/wit/workitems?$expand=all&api-version=6.0", client.BaseURL)
	
	// First get work item IDs using a WIQL query
	wiqlURL := fmt.Sprintf("%s/wit/wiql?api-version=6.0", client.BaseURL)
	wiqlQuery := map[string]string{
		"query": fmt.Sprintf("SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '%s' AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story', 'Bug', 'Task') ORDER BY [System.Id]", client.Project),
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

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	org := os.Getenv("AZURE_DEVOPS_ORG")
	project := os.Getenv("AZURE_DEVOPS_PROJECT")
	pat := os.Getenv("AZURE_DEVOPS_PAT")

	if org == "" || project == "" || pat == "" {
		log.Fatal("Please set AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, and AZURE_DEVOPS_PAT environment variables")
	}

	client := NewAzureDevOpsClient(org, project, pat)

	// Initialize Gin router
	r := gin.Default()

	// CORS middleware
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000", "http://frontend:3000"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(config))

	// Routes
	api := r.Group("/api")
	{
		api.GET("/workitems", func(c *gin.Context) {
			workItems, err := client.GetWorkItems()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, workItems)
		})

		api.PATCH("/workitems/:id", func(c *gin.Context) {
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
