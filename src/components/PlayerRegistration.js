const React = require('react');

/**
 * PlayerRegistration Component
 * 
 * A component that allows tournament organizers to add players either manually
 * or by uploading a file (Excel or Word), with Chess.com integration.
 */
function PlayerRegistration({ tournamentId, onPlayersAdded, onFileSelected }) {
  const [manualEntryMode, setManualEntryMode] = React.useState(true);
  const [players, setPlayers] = React.useState([{ 
    name: '', 
    email: '', 
    rating: '', 
    chesscomUsername: '' 
  }]);
  const [file, setFile] = React.useState(null);
  const [fileError, setFileError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isLookingUpChesscom, setIsLookingUpChesscom] = React.useState(false);
  
  // Handle switching between manual entry and file upload
  const toggleEntryMode = (mode) => {
    setManualEntryMode(mode);
    setFileError('');
    setSuccessMessage('');
  };
  
  // Add a new empty player row for manual entry
  const addPlayerRow = () => {
    setPlayers([...players, { 
      name: '', 
      email: '', 
      rating: '', 
      chesscomUsername: '' 
    }]);
  };
  
  // Remove a player row
  const removePlayerRow = (index) => {
    const updatedPlayers = [...players];
    updatedPlayers.splice(index, 1);
    setPlayers(updatedPlayers);
  };
  
  // Handle changes in the manual entry form
  const handlePlayerChange = (index, field, value) => {
    const updatedPlayers = [...players];
    updatedPlayers[index][field] = value;
    setPlayers(updatedPlayers);
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) {
      setFile(null);
      if (onFileSelected) {
        onFileSelected(null);
      }
      return;
    }
    
    // Check file type
    const fileType = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'doc', 'docx'].includes(fileType)) {
      setFileError('Please upload an Excel (.xlsx, .xls) or Word (.doc, .docx) file');
      setFile(null);
      if (onFileSelected) {
        onFileSelected(null);
      }
      return;
    }
    
    setFile(selectedFile);
    setFileError('');
    
    // Notify parent component if callback provided
    if (onFileSelected) {
      onFileSelected(selectedFile);
    }
  };
  
  // Lookup Chess.com data for players
  const lookupChesscomData = async () => {
    try {
      setIsLookingUpChesscom(true);
      
      // Get all Chess.com usernames
      const usernames = players
        .map(player => player.chesscomUsername)
        .filter(username => username && username.trim() !== '');
      
      if (usernames.length === 0) {
        setFileError('No Chess.com usernames provided');
        setIsLookingUpChesscom(false);
        return;
      }
      
      // Call the API to get Chess.com data
      const response = await fetch('/api/players/chesscom-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ usernames })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch Chess.com data');
      }
      
      if (data.data.length === 0) {
        setFileError('No valid Chess.com profiles found');
        setIsLookingUpChesscom(false);
        return;
      }
      
      // Create a map for quick lookup
      const chesscomDataMap = new Map();
      data.data.forEach(profile => {
        chesscomDataMap.set(profile.username.toLowerCase(), profile);
      });
      
      // Update players with Chess.com data
      const updatedPlayers = players.map(player => {
        if (!player.chesscomUsername) {
          return player;
        }
        
        const chesscomInfo = chesscomDataMap.get(player.chesscomUsername.toLowerCase());
        
        if (!chesscomInfo) {
          return player;
        }
        
        // Use Chess.com name if player name is empty or just username-like
        let name = player.name;
        if (!name || name === player.chesscomUsername) {
          name = chesscomInfo.name || player.chesscomUsername;
        }
        
        // Use Chess.com rating if player rating is empty
        const rating = player.rating || chesscomInfo.rating;
        
        return {
          ...player,
          name,
          rating,
          chesscomData: chesscomInfo
        };
      });
      
      setPlayers(updatedPlayers);
      setSuccessMessage(`Successfully retrieved data for ${data.data.length} Chess.com profiles`);
      
      // Notify parent component if callback provided
      if (onPlayersAdded) {
        onPlayersAdded(updatedPlayers);
      }
    } catch (error) {
      setFileError(`Error fetching Chess.com data: ${error.message}`);
    } finally {
      setIsLookingUpChesscom(false);
    }
  };
  
  // Submit manually entered players
  const submitManualPlayers = async (e) => {
    e.preventDefault();
    
    // Validate that all players have at least a name
    const isValid = players.every(player => player.name.trim() !== '');
    if (!isValid) {
      setFileError('All players must have a name');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // If we're in the context of the QuickTournamentSetup component,
      // just pass the players to the parent component
      if (onPlayersAdded && !tournamentId) {
        onPlayersAdded(players);
        setSuccessMessage(`Successfully added ${players.length} players`);
        return;
      }
      
      // Otherwise, make an API call to add players to the tournament
      const response = await fetch(`/api/tournaments/${tournamentId}/players`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ players })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add players');
      }
      
      setSuccessMessage(`Successfully added ${data.count} players to the tournament`);
      
      // Reset form after successful submission
      setPlayers([{ 
        name: '', 
        email: '', 
        rating: '', 
        chesscomUsername: '' 
      }]);
      
      // Notify parent component
      if (onPlayersAdded) {
        onPlayersAdded(data.data.addedPlayers);
      }
    } catch (error) {
      setFileError(`Failed to add players: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Submit file upload
  const submitFileUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setFileError('Please select a file to upload');
      return;
    }
    
    // If we're in the context of the QuickTournamentSetup component,
    // just notify the parent component about the file
    if (onFileSelected && !tournamentId) {
      setSuccessMessage('File selected successfully');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('playersFile', file);
      
      // Make API call to upload the file
      const response = await fetch(`/api/tournaments/${tournamentId}/players/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }
      
      setSuccessMessage(`File uploaded successfully. Added ${data.count} players to the tournament.`);
      setFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('player-file-upload');
      if (fileInput) fileInput.value = '';
      
      // Notify parent component
      if (onPlayersAdded) {
        onPlayersAdded(data.data.addedPlayers);
      }
      
      // Also notify about file being reset
      if (onFileSelected) {
        onFileSelected(null);
      }
    } catch (error) {
      setFileError(`Failed to upload file: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="player-registration-container">
      <h2>Add Players</h2>
      
      <div className="registration-tabs">
        <button 
          className={`tab-button ${manualEntryMode ? 'active' : ''}`}
          onClick={() => toggleEntryMode(true)}
        >
          Manual Entry
        </button>
        <button 
          className={`tab-button ${!manualEntryMode ? 'active' : ''}`}
          onClick={() => toggleEntryMode(false)}
        >
          File Upload
        </button>
      </div>
      
      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}
      
      {fileError && (
        <div className="alert alert-danger">{fileError}</div>
      )}
      
      {manualEntryMode ? (
        <div className="manual-entry-container">
          <form onSubmit={submitManualPlayers}>
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Player Name</th>
                    <th>Email (Optional)</th>
                    <th>Rating (Optional)</th>
                    <th>Chess.com Username</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={player.name}
                          onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
                          placeholder="Enter player name"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          className="form-control"
                          value={player.email}
                          onChange={(e) => handlePlayerChange(index, 'email', e.target.value)}
                          placeholder="Enter email (optional)"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          value={player.rating}
                          onChange={(e) => handlePlayerChange(index, 'rating', e.target.value)}
                          placeholder="Enter rating (optional)"
                          min="0"
                          max="3000"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={player.chesscomUsername}
                          onChange={(e) => handlePlayerChange(index, 'chesscomUsername', e.target.value)}
                          placeholder="Chess.com username"
                        />
                      </td>
                      <td>
                        {players.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => removePlayerRow(index)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="form-actions">
              <div>
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  onClick={addPlayerRow}
                >
                  Add Another Player
                </button>
                <button
                  type="button"
                  className="btn btn-info"
                  onClick={lookupChesscomData}
                  disabled={isLookingUpChesscom || isLoading}
                >
                  {isLookingUpChesscom ? 'Looking up...' : 'Lookup Chess.com Data'}
                </button>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || isLookingUpChesscom}
              >
                {isLoading ? 'Adding Players...' : tournamentId ? 'Add Players to Tournament' : 'Save Players'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="file-upload-container">
          <form onSubmit={submitFileUpload}>
            <div className="file-upload-instructions">
              <h4>File Upload Instructions</h4>
              <p>Upload an Excel or Word file with player information.</p>
              <ul>
                <li>Excel files should have columns for Name, Email, Rating, and Chess.com Username</li>
                <li>Word files should list one player per line with comma-separated values</li>
                <li>Only .xlsx, .xls, .doc, and .docx files are supported</li>
                <li>Maximum file size: 5MB</li>
              </ul>
              
              <div className="template-download">
                <p>Download a template file:</p>
                <a href="/templates/players_template.xlsx" className="btn btn-outline-secondary btn-sm">
                  Excel Template
                </a>
                <a href="/templates/players_template.docx" className="btn btn-outline-secondary btn-sm ms-2">
                  Word Template
                </a>
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="player-file-upload" className="form-label">Select File</label>
              <input
                type="file"
                className="form-control"
                id="player-file-upload"
                onChange={handleFileChange}
                accept=".xlsx,.xls,.doc,.docx"
              />
              {file && (
                <div className="selected-file mt-2">
                  Selected file: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)
                </div>
              )}
            </div>
            
            <div className="form-text mb-3">
              <p className="mb-1">
                <strong>Note:</strong> The system will automatically look up Chess.com profiles for any usernames included in the file.
              </p>
              <p className="mb-0">
                Player ratings will be updated with Chess.com ratings if available.
              </p>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !file}
            >
              {isLoading ? 'Uploading...' : tournamentId ? 'Upload and Add Players' : 'Select File'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

module.exports = PlayerRegistration; 