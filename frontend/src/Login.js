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
    pat: '',
    areaPath: ''
  });
  const [showPAT, setShowPAT] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areaPaths, setAreaPaths] = useState([]);
  const [fetchingAreaPaths, setFetchingAreaPaths] = useState(false);

  const fetchAreaPaths = async () => {
    if (!formData.organization || !formData.project || !formData.pat) {
      return;
    }

    setFetchingAreaPaths(true);
    setError('');

    try {
      // Create a temporary client to fetch area paths
      const tempClient = {
        organization: formData.organization,
        project: formData.project,
        pat: formData.pat
      };

      const response = await axios.post(`${API_BASE_URL}/temp-areapaths`, tempClient);
      setAreaPaths(response.data || []);
    } catch (err) {
      setError('Failed to fetch area paths. Please check your credentials.');
      setAreaPaths([]);
    } finally {
      setFetchingAreaPaths(false);
    }
  };

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
        localStorage.setItem('selectedAreaPath', response.data.areaPath);
        
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

          {/* Area Path Fetch Button */}
          <div className="form-group">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={fetchAreaPaths}
              disabled={loading || fetchingAreaPaths || !formData.organization || !formData.project || !formData.pat}
            >
              {fetchingAreaPaths ? 'Fetching Area Paths...' : 'Fetch Area Paths'}
            </button>
            <small className="form-text">
              Click to fetch available area paths after entering your credentials above
            </small>
          </div>

          {/* Area Path Selection */}
          <div className="form-group">
            <label htmlFor="areaPath">Area Path</label>
            <select
              id="areaPath"
              name="areaPath"
              className="form-control"
              value={formData.areaPath}
              onChange={handleInputChange}
              required
              disabled={loading || areaPaths.length === 0}
            >
              <option value="">Select an area path...</option>
              {areaPaths.map((areaPath) => (
                <option key={areaPath.path} value={areaPath.path}>
                  {areaPath.path}
                </option>
              ))}
            </select>
            <small className="form-text">
              Select the area path you want to work with (required)
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
