import React, { useState, useEffect } from 'react';
import { Plus, Edit, X } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8080/api';

function App() {
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    state: 'New',
    workItemType: 'User Story'
  });

  useEffect(() => {
    fetchWorkItems();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
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

        await axios.patch(`${API_BASE_URL}/workitems/${editingItem.id}`, updates);
      } else {
        // Create new work item
        const fields = {
          'System.Title': formData.title,
          'System.Description': formData.description,
          'System.State': formData.state
        };

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
      workItemType: 'User Story'
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
      workItemType: workItem.fields['System.WorkItemType'] || 'User Story'
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
    return `state-${state.toLowerCase()}`;
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

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
          <h1>Azure DevOps Board Manager</h1>
        </div>
      </header>

      <div className="container">
        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="work-items-grid">
          {workItems.map((workItem) => (
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
                {!editingItem && (
                  <div className="form-group">
                    <label htmlFor="workItemType">Work Item Type</label>
                    <select
                      id="workItemType"
                      className="form-control"
                      value={formData.workItemType}
                      onChange={(e) => setFormData({...formData, workItemType: e.target.value})}
                    >
                      <option value="User Story">User Story</option>
                      <option value="Product Backlog Item">Product Backlog Item</option>
                      <option value="Bug">Bug</option>
                      <option value="Task">Task</option>
                    </select>
                  </div>
                )}

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
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
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
