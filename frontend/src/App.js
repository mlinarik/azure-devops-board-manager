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
    workItemType: '',
    tag: '',
    selectedStates: [],
    selectedTags: []
  });
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    state: 'New',
    workItemType: '',
    areaPath: '',
    tags: '',
    effort: '',
    businessValue: '',
    govType: '',
    impact: '',
    costSavings: '',
    effortCategory: '',
    complexity: '',
    acceptanceCriteria: '',
    discussionComment: '',
    parentId: '',
    childIds: []
  });
  const [availableWorkItems, setAvailableWorkItems] = useState([]);
  const [workItemRelations, setWorkItemRelations] = useState({});

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStateDropdown && !event.target.closest('.custom-dropdown.state-dropdown')) {
        setShowStateDropdown(false);
      }
      if (showTagDropdown && !event.target.closest('.custom-dropdown.tag-dropdown')) {
        setShowTagDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStateDropdown, showTagDropdown]);

  // Auto-calculate business value when categories change
  useEffect(() => {
    if (formData.govType && formData.impact && formData.costSavings && formData.effortCategory && formData.complexity) {
      const calculatedValue = calculateBusinessValue(
        formData.govType, 
        formData.impact, 
        formData.costSavings, 
        formData.effortCategory, 
        formData.complexity
      );
      setFormData(prev => ({ ...prev, businessValue: calculatedValue }));
    }
  }, [formData.govType, formData.impact, formData.costSavings, formData.effortCategory, formData.complexity]);

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
      const items = response.data || [];
      setWorkItems(items);
      setAvailableWorkItems(items); // For parent/child selection
      
      // Fetch relationships for all work items
      const relationsMap = {};
      for (const item of items) {
        const relationData = await fetchWorkItemRelations(item.id);
        if (relationData && relationData.relations) {
          relationsMap[item.id] = relationData.relations;
        }
      }
      setWorkItemRelations(relationsMap);
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch work items: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkItemRelations = async (workItemId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/workitems/${workItemId}/relations`);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch work item relations:', err);
      return null;
    }
  };

  const addWorkItemRelation = async (childId, parentId) => {
    try {
      await axios.post(`${API_BASE_URL}/workitems/${childId}/relations`, {
        parentId: parentId,
        relType: 'System.LinkTypes.Hierarchy-Forward'
      });
    } catch (err) {
      throw new Error('Failed to add relationship: ' + (err.response?.data?.error || err.message));
    }
  };

  const removeWorkItemRelation = async (workItemId, relationIndex) => {
    try {
      await axios.delete(`${API_BASE_URL}/workitems/${workItemId}/relations/${relationIndex}`);
    } catch (err) {
      throw new Error('Failed to remove relationship: ' + (err.response?.data?.error || err.message));
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

  // Get unique tags from all work items
  const getUniqueTags = () => {
    const allTags = workItems
      .map(item => item.fields['System.Tags'])
      .filter(Boolean)
      .flatMap(tagString => tagString.split(';'))
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    return [...new Set(allTags)].sort();
  };

  // Get unique states from all work items
  const getUniqueStates = () => {
    const states = workItems.map(item => item.fields['System.State']).filter(Boolean);
    return [...new Set(states)].sort();
  };

  // Filter work items based on current filters
  const getFilteredWorkItems = () => {
    return workItems.filter(workItem => {
      const areaPathMatch = !filters.areaPath || 
        workItem.fields['System.AreaPath'] === filters.areaPath;
      
      const typeMatch = !filters.workItemType || 
        workItem.fields['System.WorkItemType'] === filters.workItemType;
      
      const tagMatch = filters.selectedTags.length === 0 || 
        (workItem.fields['System.Tags'] && 
         filters.selectedTags.some(selectedTag => 
           workItem.fields['System.Tags'].split(';').map(tag => tag.trim()).includes(selectedTag)
         ));

      const stateMatch = filters.selectedStates.length === 0 || 
        filters.selectedStates.includes(workItem.fields['System.State']);
      
      return areaPathMatch && typeMatch && tagMatch && stateMatch;
    });
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Handle state filter toggle
  const handleStateFilterToggle = (state) => {
    setFilters(prev => ({
      ...prev,
      selectedStates: prev.selectedStates.includes(state)
        ? prev.selectedStates.filter(s => s !== state)
        : [...prev.selectedStates, state]
    }));
  };

  // Handle tag filter toggle
  const handleTagFilterToggle = (tag) => {
    setFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag]
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      areaPath: '',
      workItemType: '',
      tag: '',
      selectedStates: [],
      selectedTags: []
    });
    setShowStateDropdown(false);
    setShowTagDropdown(false);
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

        // Add effort update if provided (for Product Backlog Items)
        if (formData.effort && formData.workItemType === 'Product Backlog Item') {
          updates.push({
            op: 'replace',
            path: '/fields/Microsoft.VSTS.Scheduling.Effort',
            value: parseFloat(formData.effort) || 0
          });
        }

        // Calculate and add business value based on categories
        const calculatedBusinessValue = calculateBusinessValue(
          formData.govType, 
          formData.impact, 
          formData.costSavings, 
          formData.effortCategory, 
          formData.complexity
        );
        
        if (calculatedBusinessValue > 0) {
          updates.push({
            op: 'replace',
            path: '/fields/Microsoft.VSTS.Common.BusinessValue',
            value: calculatedBusinessValue
          });
        }

        // Store business value categories as tags (append to existing tags)
        if (formData.govType || formData.impact || formData.costSavings || formData.effortCategory || formData.complexity) {
          const categoryTags = [];
          if (formData.govType) {
            const govTypeLabels = { '1': 'RTB', '2': 'BIT', '3': 'Discretionary', '4': 'Security', '5': 'Compliance' };
            categoryTags.push(`Gov:${govTypeLabels[formData.govType]}`);
          }
          if (formData.impact) {
            const impactLabels = { '1': 'High-Impact', '2': 'Medium-Impact', '3': 'Low-Impact' };
            categoryTags.push(`Impact:${impactLabels[formData.impact]}`);
          }
          if (formData.costSavings) {
            const costLabels = { '1': '>1M', '2': '=1M', '3': '<1M' };
            categoryTags.push(`Cost:${costLabels[formData.costSavings]}`);
          }
          if (formData.effortCategory) {
            const effortLabels = { '1': 'Low-Effort', '2': 'Medium-Effort', '3': 'High-Effort' };
            categoryTags.push(`Effort:${effortLabels[formData.effortCategory]}`);
          }
          if (formData.complexity) {
            const complexityLabels = { '1': 'Low-Complexity', '2': 'Medium-Complexity', '3': 'High-Complexity' };
            categoryTags.push(`Complexity:${complexityLabels[formData.complexity]}`);
          }
          
          // Combine with existing tags (filter out old business value category tags)
          const existingTags = formData.tags ? formData.tags.split(';').map(tag => tag.trim()).filter(tag => tag) : [];
          const nonCategoryTags = existingTags.filter(tag => 
            !tag.startsWith('Gov:') && 
            !tag.startsWith('Impact:') && 
            !tag.startsWith('Cost:') && 
            !tag.startsWith('Effort:') && 
            !tag.startsWith('Complexity:')
          );
          const allTags = [...nonCategoryTags, ...categoryTags].join('; ');
          
          updates.push({
            op: 'replace',
            path: '/fields/System.Tags',
            value: allTags
          });
        }

        // Add acceptance criteria update if provided
        if (formData.acceptanceCriteria) {
          updates.push({
            op: 'replace',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: formData.acceptanceCriteria
          });
        }

        // Add discussion comment if provided
        if (formData.discussionComment && formData.discussionComment.trim()) {
          updates.push({
            op: 'add',
            path: '/fields/System.History',
            value: formData.discussionComment
          });
        }

        await axios.patch(`${API_BASE_URL}/workitems/${editingItem.id}`, updates);
        
        // Handle parent relationship changes
        const originalParentId = getParentId(workItemRelations[editingItem.id] || []);
        const newParentId = formData.parentId ? parseInt(formData.parentId) : null;
        
        if (originalParentId !== newParentId) {
          // Remove old parent relationship if exists
          if (originalParentId) {
            const relationData = await fetchWorkItemRelations(editingItem.id);
            if (relationData && relationData.relations) {
              const parentRelationIndex = relationData.relations.findIndex(rel => 
                rel.rel === 'System.LinkTypes.Hierarchy-Reverse' && 
                extractWorkItemIdFromUrl(rel.url) === originalParentId
              );
              if (parentRelationIndex !== -1) {
                await removeWorkItemRelation(editingItem.id, parentRelationIndex);
              }
            }
          }
          
          // Add new parent relationship if specified
          if (newParentId) {
            await addWorkItemRelation(editingItem.id, newParentId, 'System.LinkTypes.Hierarchy-Reverse');
          }
        }
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

        // Add effort if provided (for Product Backlog Items)
        if (formData.effort && formData.workItemType === 'Product Backlog Item') {
          fields['Microsoft.VSTS.Scheduling.Effort'] = parseFloat(formData.effort) || 0;
        }

        // Calculate and add business value based on categories
        const calculatedBusinessValue = calculateBusinessValue(
          formData.govType, 
          formData.impact, 
          formData.costSavings, 
          formData.effortCategory, 
          formData.complexity
        );
        
        if (calculatedBusinessValue > 0) {
          fields['Microsoft.VSTS.Common.BusinessValue'] = calculatedBusinessValue;
        }

        // Store business value categories as tags (combine with existing tags)
        if (formData.govType || formData.impact || formData.costSavings || formData.effortCategory || formData.complexity) {
          const categoryTags = [];
          if (formData.govType) {
            const govTypeLabels = { '1': 'RTB', '2': 'BIT', '3': 'Discretionary', '4': 'Security', '5': 'Compliance' };
            categoryTags.push(`Gov:${govTypeLabels[formData.govType]}`);
          }
          if (formData.impact) {
            const impactLabels = { '1': 'High-Impact', '2': 'Medium-Impact', '3': 'Low-Impact' };
            categoryTags.push(`Impact:${impactLabels[formData.impact]}`);
          }
          if (formData.costSavings) {
            const costLabels = { '1': '>1M', '2': '=1M', '3': '<1M' };
            categoryTags.push(`Cost:${costLabels[formData.costSavings]}`);
          }
          if (formData.effortCategory) {
            const effortLabels = { '1': 'Low-Effort', '2': 'Medium-Effort', '3': 'High-Effort' };
            categoryTags.push(`Effort:${effortLabels[formData.effortCategory]}`);
          }
          if (formData.complexity) {
            const complexityLabels = { '1': 'Low-Complexity', '2': 'Medium-Complexity', '3': 'High-Complexity' };
            categoryTags.push(`Complexity:${complexityLabels[formData.complexity]}`);
          }
          
          // Combine with existing tags (filter out old business value category tags)
          const existingTags = formData.tags ? formData.tags.split(';').map(tag => tag.trim()).filter(tag => tag) : [];
          const nonCategoryTags = existingTags.filter(tag => 
            !tag.startsWith('Gov:') && 
            !tag.startsWith('Impact:') && 
            !tag.startsWith('Cost:') && 
            !tag.startsWith('Effort:') && 
            !tag.startsWith('Complexity:')
          );
          const allTags = [...nonCategoryTags, ...categoryTags].join('; ');
          
          fields['System.Tags'] = allTags;
        }

        // Add acceptance criteria if provided
        if (formData.acceptanceCriteria) {
          fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = formData.acceptanceCriteria;
        }

        // Add initial discussion comment if provided
        if (formData.discussionComment && formData.discussionComment.trim()) {
          fields['System.History'] = formData.discussionComment;
        }

        const response = await axios.post(`${API_BASE_URL}/workitems`, {
          workItemType: formData.workItemType,
          fields: fields
        });
        
        // Add parent relationship if specified
        if (formData.parentId && response.data && response.data.id) {
          const newWorkItemId = response.data.id;
          await addWorkItemRelation(newWorkItemId, parseInt(formData.parentId), 'System.LinkTypes.Hierarchy-Reverse');
        }
      }

      setShowModal(false);
      setEditingItem(null);
      // Clear the discussion comment after submission since it's been added to history
      setFormData(prev => ({...prev, discussionComment: ''}));
      resetForm();
      fetchWorkItems();
    } catch (err) {
      setError('Failed to save work item: ' + (err.response?.data?.error || err.message));
    }
  };

  // Get valid states for a work item type
  const getValidStates = (workItemType) => {
    switch (workItemType) {
      case 'Epic':
      case 'Feature':
        return [
          { value: 'New', label: 'New' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Done', label: 'Done' },
          { value: 'Removed', label: 'Removed' }
        ];
      case 'Product Backlog Item':
        return [
          { value: 'New', label: 'New' },
          { value: 'Approved', label: 'Approved' },
          { value: 'Committed', label: 'Committed' },
          { value: 'Done', label: 'Done' },
          { value: 'Removed', label: 'Removed' }
        ];
      default:
        // Default states for other work item types (Task, Bug, etc.)
        return [
          { value: 'New', label: 'New' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Resolved', label: 'Resolved' },
          { value: 'Closed', label: 'Closed' }
        ];
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      state: 'New',
      workItemType: '',
      areaPath: '',
      tags: '',
      effort: '',
      businessValue: '',
      govType: '',
      impact: '',
      costSavings: '',
      effortCategory: '',
      complexity: '',
      acceptanceCriteria: '',
      discussionComment: '',
      parentId: '',
      childIds: []
    });
  };

  // Calculate business value score based on weighted categories
  const calculateBusinessValue = (govType, impact, costSavings, effortCategory, complexity) => {
    if (!govType || !impact || !costSavings || !effortCategory || !complexity) {
      return 0; // Return 0 if any category is missing
    }

    // Convert string values to numbers (lower is better except for effort)
    const govTypeScore = parseInt(govType);
    const impactScore = parseInt(impact);
    const costSavingsScore = parseInt(costSavings);
    const effortScore = 4 - parseInt(effortCategory); // Reverse for effort (higher effort is better)
    const complexityScore = parseInt(complexity);

    // Apply weights and calculate weighted score
    const weightedScore = (
      (govTypeScore * 0.20) +     // 20% weight
      (impactScore * 0.30) +      // 30% weight  
      (costSavingsScore * 0.30) + // 30% weight
      (effortScore * 0.10) +      // 10% weight (reversed)
      (complexityScore * 0.10)    // 10% weight
    );

    // Convert to a score out of 100 (lower weighted score = higher business value)
    // Scale: 1.0 = 100, 5.0 = 0
    const businessValueScore = Math.max(0, Math.round(100 - ((weightedScore - 1) / 4) * 100));
    
    return businessValueScore;
  };

  // Helper function to parse business value categories from tags
  const parseCategoriesFromTags = (tags) => {
    if (!tags) return { govType: '', impact: '', costSavings: '', effortCategory: '', complexity: '' };
    
    const categories = { govType: '', impact: '', costSavings: '', effortCategory: '', complexity: '' };
    
    const tagList = tags.split(';').map(tag => tag.trim());
    
    // Parse government type
    const govTag = tagList.find(tag => tag.startsWith('Gov:'));
    if (govTag) {
      const govValue = govTag.split(':')[1];
      const govMapping = { 'RTB': '1', 'BIT': '2', 'Discretionary': '3', 'Security': '4', 'Compliance': '5' };
      categories.govType = govMapping[govValue] || '';
    }
    
    // Parse impact
    const impactTag = tagList.find(tag => tag.startsWith('Impact:'));
    if (impactTag) {
      const impactValue = impactTag.split(':')[1];
      const impactMapping = { 'High-Impact': '1', 'Medium-Impact': '2', 'Low-Impact': '3' };
      categories.impact = impactMapping[impactValue] || '';
    }
    
    // Parse cost savings
    const costTag = tagList.find(tag => tag.startsWith('Cost:'));
    if (costTag) {
      const costValue = costTag.split(':')[1];
      const costMapping = { '>1M': '1', '=1M': '2', '<1M': '3' };
      categories.costSavings = costMapping[costValue] || '';
    }
    
    // Parse effort
    const effortTag = tagList.find(tag => tag.startsWith('Effort:'));
    if (effortTag) {
      const effortValue = effortTag.split(':')[1];
      const effortMapping = { 'Low-Effort': '1', 'Medium-Effort': '2', 'High-Effort': '3' };
      categories.effortCategory = effortMapping[effortValue] || '';
    }
    
    // Parse complexity
    const complexityTag = tagList.find(tag => tag.startsWith('Complexity:'));
    if (complexityTag) {
      const complexityValue = complexityTag.split(':')[1];
      const complexityMapping = { 'Low-Complexity': '1', 'Medium-Complexity': '2', 'High-Complexity': '3' };
      categories.complexity = complexityMapping[complexityValue] || '';
    }
    
    return categories;
  };

  const openCreateModal = () => {
    resetForm();
    setEditingItem(null);
    setShowModal(true);
  };

  const openEditModal = async (workItem) => {
    // Load work item relationships
    const relationData = await fetchWorkItemRelations(workItem.id);
    const parentId = relationData ? getParentId(relationData.relations) : null;
    const childIds = relationData ? getChildIds(relationData.relations) : [];

    // Parse business value categories from tags
    const categories = parseCategoriesFromTags(workItem.fields['System.Tags']);

    // Filter out business value category tags from the tags field to avoid conflicts
    const existingTags = workItem.fields['System.Tags'] ? workItem.fields['System.Tags'].split(';').map(tag => tag.trim()).filter(tag => tag) : [];
    const nonCategoryTags = existingTags.filter(tag => 
      !tag.startsWith('Gov:') && 
      !tag.startsWith('Impact:') && 
      !tag.startsWith('Cost:') && 
      !tag.startsWith('Effort:') && 
      !tag.startsWith('Complexity:')
    );
    const cleanTags = nonCategoryTags.join('; ');

    setFormData({
      title: workItem.fields['System.Title'] || '',
      description: workItem.fields['System.Description'] || '',
      state: workItem.fields['System.State'] || 'New',
      workItemType: workItem.fields['System.WorkItemType'] || '',
      areaPath: workItem.fields['System.AreaPath'] || '',
      tags: cleanTags,
      effort: workItem.fields['Microsoft.VSTS.Scheduling.Effort'] || '',
      businessValue: workItem.fields['Microsoft.VSTS.Common.BusinessValue'] || '',
      govType: categories.govType,
      impact: categories.impact,
      costSavings: categories.costSavings,
      effortCategory: categories.effortCategory,
      complexity: categories.complexity,
      acceptanceCriteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || '',
      discussionComment: '', // Always start empty for new comments
      parentId: parentId || '',
      childIds: childIds || []
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

  // Helper function to extract work item ID from URL
  const extractWorkItemIdFromUrl = (url) => {
    const match = url.match(/workitems\/(\d+)$/);
    return match ? parseInt(match[1]) : null;
  };

  // Helper function to get parent work item ID from relations
  const getParentId = (relations) => {
    if (!relations || !Array.isArray(relations)) return null;
    const parentRelation = relations.find(rel => rel.rel === 'System.LinkTypes.Hierarchy-Reverse');
    return parentRelation ? extractWorkItemIdFromUrl(parentRelation.url) : null;
  };

  // Helper function to get child work item IDs from relations
  const getChildIds = (relations) => {
    if (!relations || !Array.isArray(relations)) return [];
    const childRelations = relations.filter(rel => rel.rel === 'System.LinkTypes.Hierarchy-Forward');
    return childRelations.map(rel => extractWorkItemIdFromUrl(rel.url)).filter(id => id !== null);
  };

  // Helper function to get work item title by ID
  const getWorkItemTitle = (id) => {
    const workItem = availableWorkItems.find(item => item.id === parseInt(id));
    return workItem ? `#${workItem.id} - ${workItem.fields['System.Title']}` : `#${id}`;
  };

  // Handle clicking on a parent work item to navigate to it
  const handleParentClick = (parentId) => {
    const parentItem = workItems.find(wi => wi.id.toString() === parentId.toString());
    if (parentItem) {
      openEditModal(parentItem);
    }
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
              <label>Filter by Tag:</label>
              <div className="custom-dropdown tag-dropdown">
                <button
                  type="button"
                  className="dropdown-button"
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                >
                  {filters.selectedTags.length === 0 
                    ? 'Select Tags...' 
                    : `${filters.selectedTags.length} tag${filters.selectedTags.length !== 1 ? 's' : ''} selected`
                  }
                  <span className={`dropdown-arrow ${showTagDropdown ? 'open' : ''}`}>▼</span>
                </button>
                {showTagDropdown && (
                  <div className="dropdown-content">
                    {getUniqueTags().map((tag) => (
                      <label key={tag} className="dropdown-checkbox-item">
                        <input
                          type="checkbox"
                          checked={filters.selectedTags.includes(tag)}
                          onChange={() => handleTagFilterToggle(tag)}
                        />
                        <span className="tag-badge">
                          {tag}
                        </span>
                      </label>
                    ))}
                    {getUniqueTags().length === 0 && (
                      <div className="dropdown-empty">No tags available</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-group">
              <label>Filter by State:</label>
              <div className="custom-dropdown state-dropdown">
                <button
                  type="button"
                  className="dropdown-button"
                  onClick={() => setShowStateDropdown(!showStateDropdown)}
                >
                  {filters.selectedStates.length === 0 
                    ? 'Select States...' 
                    : `${filters.selectedStates.length} state${filters.selectedStates.length !== 1 ? 's' : ''} selected`
                  }
                  <span className={`dropdown-arrow ${showStateDropdown ? 'open' : ''}`}>▼</span>
                </button>
                {showStateDropdown && (
                  <div className="dropdown-content">
                    {getUniqueStates().map((state) => (
                      <label key={state} className="dropdown-checkbox-item">
                        <input
                          type="checkbox"
                          checked={filters.selectedStates.includes(state)}
                          onChange={() => handleStateFilterToggle(state)}
                        />
                        <span className={`state-badge state-${state.toLowerCase().replace(/\s+/g, '-')}`}>
                          {state}
                        </span>
                      </label>
                    ))}
                    {getUniqueStates().length === 0 && (
                      <div className="dropdown-empty">No states available</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-group">
              <button 
                className="btn btn-secondary clear-filters-btn"
                onClick={clearFilters}
                disabled={!filters.areaPath && !filters.workItemType && !filters.tag && filters.selectedStates.length === 0 && filters.selectedTags.length === 0}
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

              {workItem.fields['Microsoft.VSTS.Scheduling.Effort'] && workItem.fields['System.WorkItemType'] === 'Product Backlog Item' && (
                <div className="work-item-effort">
                  Effort: {workItem.fields['Microsoft.VSTS.Scheduling.Effort']}
                </div>
              )}

              {workItem.fields['Microsoft.VSTS.Common.BusinessValue'] && (
                <div className="work-item-business-value">
                  Business Value: {workItem.fields['Microsoft.VSTS.Common.BusinessValue']}
                </div>
              )}

              {workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] && (
                <div className="work-item-acceptance-criteria">
                  <strong>Acceptance Criteria:</strong>
                  <div className="acceptance-criteria-content">
                    {truncateText(workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'], 150)}
                  </div>
                </div>
              )}

              {workItem.fields['System.History'] && (
                <div className="work-item-discussion">
                  <strong>Latest Discussion:</strong>
                  <div className="discussion-content">
                    {truncateText(workItem.fields['System.History'], 100)}
                  </div>
                </div>
              )}

              {/* Parent/Child Relationships */}
              {workItemRelations[workItem.id] && (
                <>
                  {getParentId(workItemRelations[workItem.id]) && (
                    <div className="work-item-parent">
                      👆 Parent: 
                      <button 
                        className="btn-link parent-link"
                        onClick={() => handleParentClick(getParentId(workItemRelations[workItem.id]))}
                      >
                        {getWorkItemTitle(getParentId(workItemRelations[workItem.id]))}
                      </button>
                    </div>
                  )}
                  {getChildIds(workItemRelations[workItem.id]).length > 0 && (
                    <div className="work-item-children">
                      👇 Children: {getChildIds(workItemRelations[workItem.id]).map(childId => getWorkItemTitle(childId)).join(', ')}
                    </div>
                  )}
                </>
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
                    onChange={(e) => {
                      const newType = e.target.value;
                      const validStates = getValidStates(newType);
                      setFormData({
                        ...formData, 
                        workItemType: newType,
                        state: validStates.length > 0 ? validStates[0].value : 'New'
                      });
                    }}
                    required={!editingItem}
                    disabled={editingItem}
                  >
                    <option value="">Select type...</option>
                    <option value="Epic">Epic</option>
                    <option value="Feature">Feature</option>
                    <option value="Product Backlog Item">Product Backlog Item</option>
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
                    {getValidStates(formData.workItemType).map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
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

                {formData.workItemType === 'Product Backlog Item' && (
                  <div className="form-group">
                    <label htmlFor="effort">Effort</label>
                    <input
                      type="number"
                      id="effort"
                      className="form-control"
                      value={formData.effort}
                      onChange={(e) => setFormData({...formData, effort: e.target.value})}
                      placeholder="Story points or hours"
                      min="0"
                      step="0.5"
                    />
                    <small className="form-text">
                      Effort estimation in story points or hours for this Product Backlog Item
                    </small>
                  </div>
                )}

                {/* Business Value Categories */}
                <div className="business-value-section">
                  <h4>Business Value Assessment</h4>
                  
                  <div className="form-group">
                    <label htmlFor="govType">Government Type (20% Weight)</label>
                    <select
                      id="govType"
                      className="form-control"
                      value={formData.govType}
                      onChange={(e) => setFormData({...formData, govType: e.target.value})}
                    >
                      <option value="">Select Government Type</option>
                      <option value="1">RTB</option>
                      <option value="2">BIT</option>
                      <option value="3">Discretionary</option>
                      <option value="4">Security</option>
                      <option value="5">Compliance</option>
                    </select>
                    <small className="form-text">
                      Lower number indicates higher priority (RTB = highest priority)
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="impact">Impact (30% Weight)</label>
                    <select
                      id="impact"
                      className="form-control"
                      value={formData.impact}
                      onChange={(e) => setFormData({...formData, impact: e.target.value})}
                    >
                      <option value="">Select Impact Level</option>
                      <option value="1">High</option>
                      <option value="2">Medium</option>
                      <option value="3">Low</option>
                    </select>
                    <small className="form-text">
                      Impact level of this work item on the organization
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="costSavings">Cost Savings (30% Weight)</label>
                    <select
                      id="costSavings"
                      className="form-control"
                      value={formData.costSavings}
                      onChange={(e) => setFormData({...formData, costSavings: e.target.value})}
                    >
                      <option value="">Select Cost Savings</option>
                      <option value="1">More than $1 Million</option>
                      <option value="2">Equal to $1 Million</option>
                      <option value="3">Less than $1 Million</option>
                    </select>
                    <small className="form-text">
                      Expected cost savings from implementing this work item
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="effortCategory">Effort Required (10% Weight)</label>
                    <select
                      id="effortCategory"
                      className="form-control"
                      value={formData.effortCategory}
                      onChange={(e) => setFormData({...formData, effortCategory: e.target.value})}
                    >
                      <option value="">Select Effort Level</option>
                      <option value="1">Low</option>
                      <option value="2">Medium</option>
                      <option value="3">High</option>
                    </select>
                    <small className="form-text">
                      Higher effort can increase business value (Low effort = quick wins)
                    </small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="complexity">Complexity (10% Weight)</label>
                    <select
                      id="complexity"
                      className="form-control"
                      value={formData.complexity}
                      onChange={(e) => setFormData({...formData, complexity: e.target.value})}
                    >
                      <option value="">Select Complexity Level</option>
                      <option value="1">Low</option>
                      <option value="2">Medium</option>
                      <option value="3">High</option>
                    </select>
                    <small className="form-text">
                      Implementation complexity (lower complexity is preferred)
                    </small>
                  </div>

                  {/* Calculated Business Value Display */}
                  {formData.govType && formData.impact && formData.costSavings && formData.effortCategory && formData.complexity && (
                    <div className="calculated-business-value">
                      <strong>Calculated Business Value Score: {calculateBusinessValue(
                        formData.govType, 
                        formData.impact, 
                        formData.costSavings, 
                        formData.effortCategory, 
                        formData.complexity
                      )}/100</strong>
                      <small className="form-text">
                        Score automatically calculated based on weighted categories
                      </small>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="acceptanceCriteria">Acceptance Criteria</label>
                  <textarea
                    id="acceptanceCriteria"
                    className="form-control"
                    rows="4"
                    value={formData.acceptanceCriteria}
                    onChange={(e) => setFormData({...formData, acceptanceCriteria: e.target.value})}
                    placeholder="Define the acceptance criteria for this work item..."
                  />
                  <small className="form-text">
                    Define clear, testable criteria that must be met for this work item to be considered complete
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="discussionComment">
                    {editingItem ? 'Add Discussion Comment' : 'Initial Discussion Comment'}
                  </label>
                  <textarea
                    id="discussionComment"
                    className="form-control"
                    rows="3"
                    value={formData.discussionComment}
                    onChange={(e) => setFormData({...formData, discussionComment: e.target.value})}
                    placeholder={editingItem ? "Add a comment to the discussion..." : "Add an initial comment (optional)..."}
                  />
                  <small className="form-text">
                    {editingItem 
                      ? 'Add a comment that will appear in the work item discussion history'
                      : 'Optional: Add an initial comment to start the discussion'
                    }
                  </small>
                </div>

                {/* Parent/Child Relationships */}
                <div className="relationships-section">
                  <h4>Work Item Relationships</h4>
                  
                  {/* Parent Relationship */}
                  <div className="form-group">
                    <label htmlFor="parentId">Parent Work Item</label>
                    {editingItem && formData.parentId && (
                      <div className="current-relationship">
                        <strong>Current Parent:</strong> #{formData.parentId} - {getWorkItemTitle(parseInt(formData.parentId))}
                      </div>
                    )}
                    <select
                      id="parentId"
                      className="form-control"
                      value={formData.parentId}
                      onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                    >
                      <option value="">No parent (root level)</option>
                      {availableWorkItems
                        .filter(item => 
                          item.id !== editingItem?.id && // Don't allow self as parent
                          !formData.childIds.includes(item.id.toString()) // Don't allow children as parents
                        )
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            #{item.id} - {item.fields['System.Title']} ({item.fields['System.WorkItemType']})
                          </option>
                        ))
                      }
                    </select>
                    <small className="form-text">
                      Select a parent work item to create a hierarchical relationship
                    </small>
                  </div>

                  {/* Child Relationships */}
                  <div className="form-group">
                    <label>Child Work Items</label>
                    
                    {editingItem && formData.childIds.length > 0 && (
                      <div className="current-children">
                        <strong>Current Children:</strong>
                        {formData.childIds.map(childId => (
                          <div key={childId} className="child-item">
                            <span>#{childId} - {getWorkItemTitle(parseInt(childId))}</span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={async () => {
                                try {
                                  // Find relation index to remove
                                  const relationData = await fetchWorkItemRelations(editingItem.id);
                                  if (relationData && relationData.relations) {
                                    const childRelationIndex = relationData.relations.findIndex(rel => 
                                      rel.rel === 'System.LinkTypes.Hierarchy-Forward' && 
                                      extractWorkItemIdFromUrl(rel.url) === parseInt(childId)
                                    );
                                    if (childRelationIndex !== -1) {
                                      await removeWorkItemRelation(editingItem.id, childRelationIndex);
                                      // Update form data
                                      setFormData(prev => ({
                                        ...prev,
                                        childIds: prev.childIds.filter(id => id !== childId)
                                      }));
                                      // Refresh relationships
                                      const updatedRelations = await fetchWorkItemRelations(editingItem.id);
                                      setWorkItemRelations(prev => ({
                                        ...prev,
                                        [editingItem.id]: updatedRelations?.relations || []
                                      }));
                                    }
                                  }
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Child Selector */}
                    <div className="add-child-section">
                      <label htmlFor="addChildId">Add Child Work Item</label>
                      <select
                        id="addChildId"
                        className="form-control"
                        value=""
                        onChange={async (e) => {
                          if (e.target.value && editingItem) {
                            try {
                              const childId = parseInt(e.target.value);
                              // Add the relationship
                              await addWorkItemRelation(editingItem.id, childId, 'System.LinkTypes.Hierarchy-Forward');
                              
                              // Update form data
                              setFormData(prev => ({
                                ...prev,
                                childIds: [...prev.childIds, e.target.value]
                              }));
                              
                              // Refresh relationships
                              const updatedRelations = await fetchWorkItemRelations(editingItem.id);
                              setWorkItemRelations(prev => ({
                                ...prev,
                                [editingItem.id]: updatedRelations?.relations || []
                              }));
                              
                              // Reset selector
                              e.target.value = "";
                            } catch (err) {
                              setError(err.message);
                            }
                          }
                        }}
                      >
                        <option value="">Select a work item to add as child</option>
                        {availableWorkItems
                          .filter(item => 
                            item.id !== editingItem?.id && // Don't allow self as child
                            parseInt(formData.parentId) !== item.id && // Don't allow parent as child
                            !formData.childIds.includes(item.id.toString()) // Don't allow already linked children
                          )
                          .map(item => (
                            <option key={item.id} value={item.id}>
                              #{item.id} - {item.fields['System.Title']} ({item.fields['System.WorkItemType']})
                            </option>
                          ))
                        }
                      </select>
                      <small className="form-text">
                        Select work items to add as children of this item
                      </small>
                    </div>
                  </div>
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
