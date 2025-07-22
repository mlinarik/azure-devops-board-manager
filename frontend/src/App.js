import React, { useState, useEffect } from 'react';
import { Plus, Edit, X, LogOut } from 'lucide-react';
import axios from 'axios';
import Login from './Login';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8080/api';

function App() {
  const [workItems, setWorkItems] = useState([]);
  const [areaPaths, setAreaPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [filters, setFilters] = useState({
    areaPath: '',
    workItemType: ''
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    state: 'New',
    workItemType: '',
    areaPath: '',
    tags: ''
  });

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('authToken');
    const organization = localStorage.getItem('organization');
    const project = localStorage.getItem('project');
    
    if (token && organization && project) {
      setIsAuthenticated(true);
      setUserInfo({ organization, project });
      setupAxiosInterceptor(token);
      fetchWorkItems();
      fetchAreaPaths();
    } else {
      setLoading(false);
    }
  }, []);

  // Setup axios interceptor for authentication
  const setupAxiosInterceptor = (token) => {
    // Add request interceptor to include auth token
    axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers['X-Auth-Token'] = token;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleLogout();
        }
        return Promise.reject(error);
      }
    );
  };

  const handleLogin = (loginData) => {
    setIsAuthenticated(true);
    setUserInfo({
      organization: loginData.organization,
      project: loginData.project
    });
    setupAxiosInterceptor(loginData.token);
    fetchWorkItems();
    fetchAreaPaths();
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await axios.post(`${API_BASE_URL}/logout`);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('organization');
      localStorage.removeItem('project');
      setIsAuthenticated(false);
      setUserInfo(null);
      setWorkItems([]);
      setAreaPaths([]);
      // Clear axios interceptors
      axios.interceptors.request.clear();
      axios.interceptors.response.clear();
    }
  };

  const fetchWorkItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/workitems`);
      setWorkItems(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch work items: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchAreaPaths = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/areapaths`);
      setAreaPaths(response.data || []);
    } catch (err) {
      console.error('Failed to fetch area paths:', err);
      // Don't show error to user for area paths, just log it
    }
  };

  // Get unique work item types from the work items
  const getUniqueWorkItemTypes = () => {
    const types = workItems.map(item => item.fields['System.WorkItemType']).filter(Boolean);
    return [...new Set(types)].sort();
  };

  // Filter work items based on current filters
  const getFilteredWorkItems = () => {
    return workItems.filter(workItem => {
      const areaPathMatch = !filters.areaPath || 
        workItem.fields['System.AreaPath'] === filters.areaPath;
      
      const typeMatch = !filters.workItemType || 
        workItem.fields['System.WorkItemType'] === filters.workItemType;
      
      return areaPathMatch && typeMatch;
    });
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      areaPath: '',
      workItemType: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields for new work items
    if (!editingItem && !formData.workItemType) {
      setError('Please select a work item type');
      return;
    }
    
    try {
      if (editingItem) {
        // Update existing work item
        const updates = [
          {
            op: 'replace',
            path: '/fields/System.Title',
            value: formData.title
          },
          {
            op: 'replace',
            path: '/fields/System.Description',
            value: formData.description
          },
          {
            op: 'replace',
            path: '/fields/System.State',
            value: formData.state
          }
        ];

        // Add area path update if provided
        if (formData.areaPath) {
          updates.push({
            op: 'replace',
            path: '/fields/System.AreaPath',
            value: formData.areaPath
          });
        }

        // Add tags update if provided
        if (formData.tags) {
          updates.push({
            op: 'replace',
            path: '/fields/System.Tags',
            value: formData.tags
          });
        }

        await axios.patch(`${API_BASE_URL}/workitems/${editingItem.id}`, updates);
      } else {
        // Create new work item
        const fields = {
          'System.Title': formData.title,
          'System.Description': formData.description,
          'System.State': formData.state
        };

        // Add area path if selected
        if (formData.areaPath) {
          fields['System.AreaPath'] = formData.areaPath;
        }

        // Add tags if provided
        if (formData.tags) {
          fields['System.Tags'] = formData.tags;
        }

        await axios.post(`${API_BASE_URL}/workitems`, {
          workItemType: formData.workItemType,
          fields: fields
        });
      }

      setShowModal(false);
      setEditingItem(null);
      resetForm();
      fetchWorkItems();
    } catch (err) {
      setError('Failed to save work item: ' + (err.response?.data?.error || err.message));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      state: 'New',
      workItemType: '',
      areaPath: '',
      tags: ''
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = (workItem) => {
    setFormData({
      title: workItem.fields['System.Title'] || '',
      description: workItem.fields['System.Description'] || '',
      state: workItem.fields['System.State'] || 'New',
      workItemType: workItem.fields['System.WorkItemType'] || '',
      areaPath: workItem.fields['System.AreaPath'] || '',
      tags: workItem.fields['System.Tags'] || ''
    });
    setEditingItem(workItem);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    resetForm();
  };

  const getWorkItemTypeClass = (workItemType) => {
    if (!workItemType) return '';
    return workItemType.toLowerCase().replace(/\s+/g, '-');
  };

  const getStateClass = (state) => {
    if (!state) return 'state-new';
    return `state-${state.toLowerCase().replace(/\s+/g, '-')}`;
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading) {
    return (
      <div className="loading">
        <h2>Loading work items...</h2>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="header">
        <div className="container">
          <div className="header-content">
            <h1>Azure DevOps Board Manager</h1>
            <div className="header-info">
              <span className="user-info">
                {userInfo?.organization}/{userInfo?.project}
              </span>
              <button 
                className="btn btn-secondary logout-btn"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="filters">
          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="areaFilter">Filter by Area Path:</label>
              <select
                id="areaFilter"
                className="filter-control"
                value={filters.areaPath}
                onChange={(e) => handleFilterChange('areaPath', e.target.value)}
              >
                <option value="">All Areas</option>
                {areaPaths.map((areaPath) => (
                  <option key={areaPath.path} value={areaPath.path}>
                    {areaPath.path}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="typeFilter">Filter by Type:</label>
              <select
                id="typeFilter"
                className="filter-control"
                value={filters.workItemType}
                onChange={(e) => handleFilterChange('workItemType', e.target.value)}
              >
                <option value="">All Types</option>
                {getUniqueWorkItemTypes().map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <button 
                className="btn btn-secondary clear-filters-btn"
                onClick={clearFilters}
                disabled={!filters.areaPath && !filters.workItemType}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="filter-results">
            Showing {getFilteredWorkItems().length} of {workItems.length} work items
          </div>
        </div>

        <div className="work-items-grid">
          {getFilteredWorkItems().map((workItem) => (
            <div 
              key={workItem.id} 
              className={`work-item-card ${getWorkItemTypeClass(workItem.fields['System.WorkItemType'])}`}
            >
              <div className="work-item-header">
                <span className="work-item-id">#{workItem.id}</span>
                <span className="work-item-type">
                  {workItem.fields['System.WorkItemType'] || 'Unknown'}
                </span>
              </div>
              
              <h3 className="work-item-title">
                {workItem.fields['System.Title'] || 'Untitled'}
              </h3>
              
              <span className={`work-item-state ${getStateClass(workItem.fields['System.State'])}`}>
                {workItem.fields['System.State'] || 'New'}
              </span>
              
              <div className="work-item-description">
                {truncateText(workItem.fields['System.Description'])}
              </div>

              {workItem.fields['System.AreaPath'] && (
                <div className="work-item-area-path">
                  📁 {workItem.fields['System.AreaPath']}
                </div>
              )}

              {workItem.fields['System.Tags'] && (
                <div className="work-item-tags">
                  🏷️ {workItem.fields['System.Tags']}
                </div>
              )}
              
              <div className="work-item-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => openEditModal(workItem)}
                >
                  <Edit size={16} /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {workItems.length === 0 && !loading && (
          <div className="loading">
            <h2>No work items found</h2>
            <p>Click the + button to create your first work item.</p>
          </div>
        )}

        {workItems.length > 0 && getFilteredWorkItems().length === 0 && !loading && (
          <div className="loading">
            <h2>No work items match the current filters</h2>
            <p>Try adjusting your filters or <button 
                className="btn-link"
                onClick={clearFilters}
              >
                clear all filters
              </button> to see all work items.</p>
          </div>
        )}

        <button 
          className="add-work-item-btn"
          onClick={openCreateModal}
        >
          <Plus size={24} />
        </button>

        {showModal && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title">
                  {editingItem ? 'Edit Work Item' : 'Create New Work Item'}
                </h2>
                <button className="close-btn" onClick={closeModal}>
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="workItemType">Work Item Type</label>
                  <select
                    id="workItemType"
                    className="form-control"
                    value={formData.workItemType}
                    onChange={(e) => setFormData({...formData, workItemType: e.target.value})}
                    required={!editingItem}
                    disabled={editingItem}
                  >
                    <option value="">Select type...</option>
                    <option value="Epic">Epic</option>
                    <option value="Feature">Feature</option>
                    <option value="Task">Task</option>
                    <option value="Bug">Bug</option>
                    <option value="Issue">Issue</option>
                    <option value="Test Case">Test Case</option>
                    <option value="Test Plan">Test Plan</option>
                    <option value="Test Suite">Test Suite</option>
                  </select>
                  {editingItem && (
                    <small className="form-text">
                      Work item type cannot be changed after creation
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="title">Title</label>
                  <input
                    type="text"
                    id="title"
                    className="form-control"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    className="form-control"
                    rows="4"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="state">State</label>
                  <select
                    id="state"
                    className="form-control"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                  >
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="areaPath">Area Path</label>
                  <select
                    id="areaPath"
                    className="form-control"
                    value={formData.areaPath}
                    onChange={(e) => setFormData({...formData, areaPath: e.target.value})}
                  >
                    <option value="">Select area path...</option>
                    {areaPaths.map((areaPath) => (
                      <option key={areaPath.path} value={areaPath.path}>
                        {areaPath.path}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="tags">Tags</label>
                  <input
                    type="text"
                    id="tags"
                    className="form-control"
                    value={formData.tags}
                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    placeholder="Separate tags with semicolons (e.g., frontend; bug; high-priority)"
                  />
                  <small className="form-text">
                    Enter tags separated by semicolons. Example: frontend; urgent; bug
                  </small>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
