const React = require('react');
const PlayerRegistration = require('./PlayerRegistration');

/**
 * TournamentPlayerManagement Component
 * 
 * A component for managing players in a tournament, including registration,
 * viewing registered players, and managing player status.
 */
function TournamentPlayerManagement({ tournament, onPlayersUpdated }) {
  const [players, setPlayers] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  
  // Fetch players when component mounts or tournament changes
  React.useEffect(() => {
    if (tournament && tournament._id) {
      fetchPlayers();
    }
  }, [tournament]);
  
  // Fetch players from the tournament
  const fetchPlayers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch(`/api/tournaments/${tournament._id}`);
      // const data = await response.json();
      
      // Simulate API call with tournament data
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Use tournament participants if available
      if (tournament.participants && Array.isArray(tournament.participants)) {
        setPlayers(tournament.participants.map(p => ({
          id: p.player._id || p.player,
          name: p.player.username || 'Unknown Player',
          email: p.player.email || '',
          rating: p.player.chessRating || 1200,
          confirmed: p.confirmed,
          paid: p.paid,
          score: p.score
        })));
      } else {
        setPlayers([]);
      }
    } catch (error) {
      setError('Failed to load players. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle when players are added through the PlayerRegistration component
  const handlePlayersAdded = (newPlayers) => {
    // Refresh the player list
    fetchPlayers();
    
    // Notify parent component if needed
    if (onPlayersUpdated) {
      onPlayersUpdated();
    }
    
    setSuccessMessage(`Successfully added ${newPlayers.length || 'new'} players to the tournament`);
    
    // Clear success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 5000);
  };
  
  // Toggle player confirmation status
  const togglePlayerConfirmation = async (playerId) => {
    try {
      const playerIndex = players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return;
      
      const updatedPlayers = [...players];
      updatedPlayers[playerIndex].confirmed = !updatedPlayers[playerIndex].confirmed;
      
      // In a real implementation, this would be an API call
      // await fetch(`/api/tournaments/${tournament._id}/players/${playerId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ confirmed: updatedPlayers[playerIndex].confirmed })
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setPlayers(updatedPlayers);
      
      // Notify parent component if needed
      if (onPlayersUpdated) {
        onPlayersUpdated();
      }
    } catch (error) {
      setError('Failed to update player status. Please try again.');
    }
  };
  
  // Toggle player payment status
  const togglePlayerPayment = async (playerId) => {
    try {
      const playerIndex = players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return;
      
      const updatedPlayers = [...players];
      updatedPlayers[playerIndex].paid = !updatedPlayers[playerIndex].paid;
      
      // In a real implementation, this would be an API call
      // await fetch(`/api/tournaments/${tournament._id}/players/${playerId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ paid: updatedPlayers[playerIndex].paid })
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setPlayers(updatedPlayers);
      
      // Notify parent component if needed
      if (onPlayersUpdated) {
        onPlayersUpdated();
      }
    } catch (error) {
      setError('Failed to update player status. Please try again.');
    }
  };
  
  // Remove player from tournament
  const removePlayer = async (playerId) => {
    if (!window.confirm('Are you sure you want to remove this player from the tournament?')) {
      return;
    }
    
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/tournaments/${tournament._id}/players/${playerId}`, {
      //   method: 'DELETE'
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedPlayers = players.filter(p => p.id !== playerId);
      setPlayers(updatedPlayers);
      
      // Notify parent component if needed
      if (onPlayersUpdated) {
        onPlayersUpdated();
      }
    } catch (error) {
      setError('Failed to remove player. Please try again.');
    }
  };
  
  return (
    <div className="tournament-player-management">
      <h2>Player Management</h2>
      
      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}
      
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
      
      <div className="row">
        <div className="col-md-12 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h3 className="card-title mb-0">Add Players</h3>
            </div>
            <div className="card-body">
              <PlayerRegistration 
                tournamentId={tournament._id} 
                onPlayersAdded={handlePlayersAdded} 
              />
            </div>
          </div>
        </div>
        
        <div className="col-md-12">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h3 className="card-title mb-0">Registered Players</h3>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading players...</p>
                </div>
              ) : players.length === 0 ? (
                <div className="alert alert-info">
                  No players have been registered for this tournament yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Score</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(player => (
                        <tr key={player.id}>
                          <td>{player.name}</td>
                          <td>{player.email}</td>
                          <td>{player.rating}</td>
                          <td>
                            <span 
                              className={`badge ${player.confirmed ? 'bg-success' : 'bg-warning'}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => togglePlayerConfirmation(player.id)}
                            >
                              {player.confirmed ? 'Confirmed' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <span 
                              className={`badge ${player.paid ? 'bg-success' : 'bg-danger'}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => togglePlayerPayment(player.id)}
                            >
                              {player.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td>{player.score}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => removePlayer(player.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

module.exports = TournamentPlayerManagement; 