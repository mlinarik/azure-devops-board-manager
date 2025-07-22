import React, { useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:8080/api';

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    organization: '',
    project: '',
    pat: ''
  });
  const [showPAT, setShowPAT] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/login`, formData);
      
      if (response.data.success) {
        // Store authentication token
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('organization', response.data.organization);
        localStorage.setItem('project', response.data.project);
        
        // Call parent callback
        onLogin(response.data);
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 401) {
        setError('Invalid credentials. Please check your organization, project, and Personal Access Token.');
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <LogIn size={32} className="login-icon" />
          <h1>Azure DevOps Board Manager</h1>
          <p>Sign in with your Azure DevOps credentials</p>
        </div>

        {error && (
          <div className="error login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="organization">Organization</label>
            <input
              type="text"
              id="organization"
              name="organization"
              className="form-control"
              value={formData.organization}
              onChange={handleInputChange}
              placeholder="your-org"
              required
              disabled={loading}
            />
            <small className="form-text">
              Your Azure DevOps organization name (e.g., "mycompany" from dev.azure.com/mycompany)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="project">Project</label>
            <input
              type="text"
              id="project"
              name="project"
              className="form-control"
              value={formData.project}
              onChange={handleInputChange}
              placeholder="Your Project Name"
              required
              disabled={loading}
            />
            <small className="form-text">
              The name of your Azure DevOps project
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="pat">Personal Access Token</label>
            <div className="pat-input-container">
              <input
                type={showPAT ? "text" : "password"}
                id="pat"
                name="pat"
                className="form-control pat-input"
                value={formData.pat}
                onChange={handleInputChange}
                placeholder="Enter your Personal Access Token"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pat-toggle-btn"
                onClick={() => setShowPAT(!showPAT)}
                disabled={loading}
              >
                {showPAT ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small className="form-text">
              Create a PAT in Azure DevOps → User Settings → Personal Access Tokens with Work Items (Read & Write) permissions
            </small>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-help">
          <h3>Need help?</h3>
          <ul>
            <li>Make sure your organization and project names are correct</li>
            <li>Your PAT needs "Work Items (Read & Write)" permissions</li>
            <li>Check that your PAT hasn't expired</li>
            <li>Ensure you have access to the specified project</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Login;
