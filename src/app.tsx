import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Storage keys
const REPO_HISTORY_KEY = 'gitBranchViewer_repoHistory';
const ACTIVE_BRANCHES_HISTORY_KEY = 'gitBranchViewer_activeBranchesHistory';

const App: React.FC = () => {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [branches, setBranches] = useState<Array<{ name: string; commitCount: number }>>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTrace, setErrorTrace] = useState<string | null>(null);
  const [repoHistory, setRepoHistory] = useState<string[]>([]);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeBranches, setActiveBranches] = useState<string[]>([]);

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Load repository history and most recent repo on mount
  useEffect(() => {
    const loadSavedRepoHistory = () => {
      try {
        const savedHistory = localStorage.getItem(REPO_HISTORY_KEY);
        if (savedHistory) {
          const history = JSON.parse(savedHistory) as string[];
          setRepoHistory(history);

          // Load the most recent repository if available
          if (history.length > 0) {
            const mostRecentRepo = history[0];
            setRepoPath(mostRecentRepo);
            fetchBranches(mostRecentRepo);
          }
        }
      } catch (err) {
        console.error('Error loading repository history:', err);
      }
    };

    loadSavedRepoHistory();
  }, []);

  // Load active branches on mount
  useEffect(() => {
    const loadActiveBranches = () => {
      try {
        const savedHistory = localStorage.getItem(ACTIVE_BRANCHES_HISTORY_KEY);
        if (savedHistory) {
          const history = JSON.parse(savedHistory) as string[];
          setActiveBranches(history);
        }
      } catch (err) {
        console.error('Error loading active branches history:', err);
      }
    };

    loadActiveBranches();
  }, []);

  // Save repository to history
  const saveRepoToHistory = (path: string) => {
    // Create a new history array with the current path at the beginning
    const updatedHistory = [path];

    // Add previous paths, excluding the current one if it already exists
    repoHistory.forEach(repo => {
      if (repo !== path && updatedHistory.length < 3) {
        updatedHistory.push(repo);
      }
    });

    // Update state and save to localStorage
    setRepoHistory(updatedHistory);
    localStorage.setItem(REPO_HISTORY_KEY, JSON.stringify(updatedHistory));
  };

  // Save active branches to history
  const toggleActiveBranch = (branchName: string) => {
    // Create a new history array with the current path at the beginning
    const updatedActiveBranches = [...activeBranches];

    // Toggle branch
    if (updatedActiveBranches.includes(branchName)) {
      updatedActiveBranches.splice(updatedActiveBranches.indexOf(branchName), 1);
    } else {
      updatedActiveBranches.push(branchName);
    }

    // Update state and save to localStorage
    setActiveBranches(updatedActiveBranches);
    localStorage.setItem(ACTIVE_BRANCHES_HISTORY_KEY, JSON.stringify(updatedActiveBranches));
  };

  // Function to select a Git repository folder
  const handleSelectFolder = async () => {
    try {
      const selectedPath = await window.electronAPI.selectFolder();
      if (selectedPath) {
        setRepoPath(selectedPath);
        saveRepoToHistory(selectedPath);
        await fetchBranches(selectedPath);
      }
    } catch (err) {
      setError('Failed to select folder');
      console.error(err);
    }
  };

  // Function to select a repository from history
  const handleSelectRepoFromHistory = async (path: string) => {
    if (path === repoPath) return; // Skip if already selected

    setRepoPath(path);
    saveRepoToHistory(path);
    await fetchBranches(path);
  };

  // Function to fetch branches from the selected repository
  const fetchBranches = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { branches, currentBranch } = await window.electronAPI.getBranches(path);
      console.log('branches', branches);
      setBranches(branches);
      setCurrentBranch(currentBranch);
    } catch (err) {
      setError('Failed to fetch branches. Make sure the selected folder is a Git repository.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a branch
  const handleDeleteBranch = async (branchName: string) => {
    if (!repoPath) return;

    // Don't allow deleting the current branch
    if (branchName === currentBranch) {
      setError(`Cannot delete the currently checked out branch: ${branchName}`);
      return;
    }

    if (branchName === 'main' || branchName === 'master') {
      setError(`Cannot delete the main branch: ${branchName}`);
      return;
    }

    setIsLoading(true);
    try {
      const success = await window.electronAPI.deleteBranch(repoPath, branchName);
      if (success) {
        // remove branch from active branches
        setActiveBranches(prev => prev.filter(branch => branch !== branchName));
        // Refresh the branch list after successful deletion
        await fetchBranches(repoPath);
      } else {
        setError(`Failed to delete branch: ${branchName}`);
      }
    } catch (err) {
      setError(`Error deleting branch: ${branchName}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to checkout a branch
  const handleCheckoutBranch = async (branchName: string) => {
    if (!repoPath) return;

    // Skip if already on this branch
    if (branchName === currentBranch) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorTrace(null);

    try {
      const result = await window.electronAPI.checkoutBranch(repoPath, branchName);
      if (result.success) {
        // Refresh the branch list after successful checkout
        await fetchBranches(repoPath);
      } else {
        setError(`Failed to checkout branch: ${branchName}`);
        if (result.errorTrace) {
          setErrorTrace(result.errorTrace);
        }
      }
    } catch (err) {
      setError(`Error checking out branch: ${branchName}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch from origin
  const handleFetchOrigin = async () => {
    if (!repoPath) return;

    setIsFetching(true);
    setError(null);
    setErrorTrace(null);
    setFetchMessage(null);

    try {
      const result = await window.electronAPI.fetchOrigin(repoPath);
      if (result.success) {
        setFetchMessage(result.output || 'Fetch completed successfully');
        // Refresh branches after successful fetch
        await fetchBranches(repoPath);
      } else {
        setError(`Failed to fetch from origin`);
        if (result.errorTrace) {
          setErrorTrace(result.errorTrace);
        }
      }
    } catch (err) {
      setError(`Error fetching from origin`);
      console.error(err);
    } finally {
      setIsFetching(false);

      // Auto-hide fetch message after 5 seconds
      setTimeout(() => {
        setFetchMessage(null);
      }, 5000);
    }
  };

  return (
    <div className="container">
      <header>
        <div className="header-top">
          {repoPath && (
            <button
              onClick={handleFetchOrigin}
              disabled={isLoading || isFetching}
              className={`fetch-button ${isFetching ? 'fetching' : ''}`}
              title="Fetch latest changes from origin"
            >
              {isFetching ? 'Fetching...' : 'Fetch Origin'}
            </button>
          )}
        </div>

        {fetchMessage && <div className="fetch-message">{fetchMessage}</div>}

        {repoHistory.length > 0 && (
          <div className="repo-history">
            <h3>Recent Repositories</h3>
            <div className="repo-history-list">
              {repoHistory.map((repo, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectRepoFromHistory(repo)}
                  className={`repo-history-item ${repo === repoPath ? 'active' : ''}`}
                  title={repo}
                  disabled={isLoading}
                >
                  {repo.split('/').pop() || repo}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleSelectFolder} disabled={isLoading} className="select-button">
          Select Repository
        </button>

        {repoPath && (
          <div className="repo-path">
            <strong>Repository:</strong> {repoPath}
          </div>
        )}
      </header>

      {error && (
        <div className="error-container">
          <div className="error-message">
            {error}
            <button
              onClick={() => {
                setError(null);
                setErrorTrace(null);
              }}
              className="close-button"
            >
              ×
            </button>
          </div>
          {errorTrace && (
            <div className="error-trace">
              <pre>{errorTrace}</pre>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="branches-container">
          {branches.length > 0 ? (
            <>
              <div className="branches-header">
                <h2>Git Branches</h2>
                <div className="search-container">
                  <div className="search-input-wrapper">
                    <input
                      type="text"
                      placeholder="Search branches..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="branch-search"
                    />
                    {searchTerm && (
                      <button
                        className="search-clear-button"
                        onClick={() => setSearchTerm('')}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <ul className="branch-list">
                {filteredBranches.map(branch => (
                  <li
                    key={branch.name}
                    className={branch.name === currentBranch ? 'current-branch' : ''}
                    onDoubleClick={() => toggleActiveBranch(branch.name)}
                  >
                    <div className={activeBranches.includes(branch.name) ? 'branch-info' : ''}>
                      <span 
                        className="branch-name" 
                        title={branch.name}
                      >
                        {branch.name}
                      </span>
                      {branch.commitCount > 0 && (
                        <span className="commit-count">
                          <span className="arrow-up">↑</span>
                          {branch.commitCount}
                        </span>
                      )}
                      {branch.name === currentBranch && (
                        <span className="current-indicator">current</span>
                      )}
                    </div>
                    <div className="branch-actions">
                      {branch.name !== currentBranch && (
                        <>
                          <button
                            onClick={() => handleCheckoutBranch(branch.name)}
                            className="checkout-button"
                            title={`Checkout branch ${branch.name}`}
                          >
                            <svg
                              className="checkout-icon"
                              viewBox="0 0 16 16"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path d="M14,4c0-1.103-0.897-2-2-2s-2,0.897-2,2c0,0.737,0.405,1.375,1,1.722V6c0,0.551-0.448,1-1,1H7.5C6.575,7,5.716,7.282,5,7.762v-3.04C5.595,4.375,6,3.737,6,3c0-1.103-0.897-2-2-2S2,1.897,2,3c0,0.737,0.405,1.375,1,1.722v6.556C2.405,11.625,2,12.263,2,13c0,1.103,0.897,2,2,2s2-0.897,2-2c0-0.728-0.395-1.36-0.979-1.71C5.13,10.011,6.194,9,7.5,9H10c1.654,0,3-1.346,3-3V5.722C13.595,5.375,14,4.737,14,4z M4,2c0.551,0,1,0.449,1,1S4.551,4,4,4S3,3.551,3,3S3.449,2,4,2z M4,14c-0.551,0-1-0.448-1-1s0.449-1,1-1s1,0.448,1,1S4.551,14,4,14z M12,5c-0.552,0-1-0.449-1-1s0.448-1,1-1s1,0.449,1,1S12.552,5,12,5z" />
                            </svg>
                          </button>
                          {branch.name !== 'main' && branch.name !== 'master' && (
                            <button
                              onClick={() => handleDeleteBranch(branch.name)}
                              className="delete-button"
                              title={`Delete branch ${branch.name}`}
                            >
                              ×
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : repoPath ? (
            <div className="no-branches">No branches found in this repository.</div>
          ) : (
            <div className="no-repo">Please select a Git repository to view branches.</div>
          )}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.body);
root.render(<App />);
