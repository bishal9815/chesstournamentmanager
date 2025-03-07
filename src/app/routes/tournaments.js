const express = require('express');
const router = express.Router();
const Tournament = require('../../models/Tournament');
const Match = require('../../models/Match');
const User = require('../../models/User');
const { generateSwissPairings } = require('../../lib/swissPairing');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only Excel and Word files
  const filetypes = /xlsx|xls|doc|docx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only Excel and Word files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate('organizer', 'username email')
      .sort({ startDate: -1 });
    
    res.status(200).json({
      success: true,
      count: tournaments.length,
      data: tournaments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Get single tournament
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching tournament details for ID:', req.params.id);
    
    const tournament = await Tournament.findById(req.params.id)
      .populate('organizer', 'username email')
      .populate('participants.player', 'username firstName lastName chessRating');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Get matches for this tournament
    const matches = await Match.find({ tournament: req.params.id })
      .populate('whitePlayer', 'username firstName lastName chessRating')
      .populate('blackPlayer', 'username firstName lastName chessRating')
      .sort({ round: 1, board: 1 });
    
    console.log(`Found tournament: ${tournament.name} with ${tournament.participants.length} participants and ${matches.length} matches`);
    
    // Log match details for debugging
    if (matches.length > 0) {
      console.log('Sample match data:', JSON.stringify(matches[0]));
    }
    
    res.status(200).json({
      success: true,
      data: {
        tournament,
        matches
      }
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Create new tournament
router.post('/', async (req, res) => {
  try {
    console.log('Creating new tournament with data:', req.body);
    
    // IMPORTANT: Authentication check removed for testing
    // We're allowing anyone to create tournaments
    
    // Validate required fields
    const { name, location, startDate, endDate, rounds } = req.body;
    
    if (!name || !location || !startDate || !endDate || !rounds) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, location, startDate, endDate, and rounds'
      });
    }
    
    // Find a default user to use as organizer
    let organizerId;
    
    if (req.user) {
      organizerId = req.user.id;
    } else {
      // Try to find an admin user
      const User = require('../../models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      
      if (adminUser) {
        organizerId = adminUser._id;
      } else {
        // Try to find any user
        const anyUser = await User.findOne({});
        
        if (anyUser) {
          organizerId = anyUser._id;
        } else {
          // Create a default user if none exists
          const defaultUser = await User.create({
            username: 'defaultadmin',
            email: 'admin@example.com',
            password: 'password123',
            firstName: 'Default',
            lastName: 'Admin',
            role: 'admin'
          });
          
          organizerId = defaultUser._id;
        }
      }
    }
    
    // Create tournament with user as organizer
    const tournament = await Tournament.create({
      ...req.body,
      organizer: organizerId
    });
    
    console.log('Tournament created successfully:', tournament);
    
    res.status(201).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Server Error: ' + error.message
      });
    }
  }
});

// Update tournament
router.put('/:id', async (req, res) => {
  try {
    console.log('Updating tournament:', req.params.id);
    console.log('Update data:', req.body);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    let tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to update any tournament
    
    tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    console.log('Tournament updated successfully:', tournament);
    
    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error updating tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Delete tournament
router.delete('/:id', async (req, res) => {
  try {
    console.log('Deleting tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to delete any tournament
    
    // Delete all matches associated with this tournament
    await Match.deleteMany({ tournament: req.params.id });
    
    // Delete the tournament
    // Using findByIdAndDelete instead of remove() which is deprecated
    await Tournament.findByIdAndDelete(req.params.id);
    
    console.log('Tournament deleted successfully');
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Register player for tournament
router.post('/:id/register', async (req, res) => {
  try {
    console.log('Registering player for tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if registration is open
    if (tournament.status !== 'registration') {
      return res.status(400).json({
        success: false,
        error: 'Registration is not open for this tournament'
      });
    }
    
    // Get player ID from request or use current user
    let playerId = req.body.playerId;
    
    if (!playerId && req.user) {
      playerId = req.user.id;
    }
    
    if (!playerId) {
      // If no player ID provided and no user logged in, try to find a default player
      const Player = require('../../models/Player');
      const defaultPlayer = await Player.findOne({});
      
      if (defaultPlayer) {
        playerId = defaultPlayer._id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No player ID provided and no default player found'
        });
      }
    }
    
    // Check if player is already registered
    const isRegistered = tournament.participants.some(
      p => p.player && p.player.toString() === playerId.toString()
    );
    
    if (isRegistered) {
      return res.status(400).json({
        success: false,
        error: 'Player is already registered for this tournament'
      });
    }
    
    // Add player to participants
    tournament.participants.push({
      player: playerId,
      confirmed: true,
      paid: false,
      score: 0,
      tieBreak: 0
    });
    
    await tournament.save();
    
    console.log('Player registered successfully');
    
    res.status(200).json({
      success: true,
      data: tournament
    });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Add multiple players to tournament (manual entry)
router.post('/:id/players', async (req, res) => {
  try {
    console.log('Adding players to tournament:', req.params.id);
    console.log('Request body:', req.body);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const { players } = req.body;
    
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of players'
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to add players to any tournament
    
    // Import our player data service
    const { processAndStorePlayerData } = require('../../lib/services/playerDataService');
    
    // Process and store the player data
    const result = await processAndStorePlayerData({
      manualData: players,
      storeInDatabase: true
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process player data'
      });
    }
    
    // Add the stored players to the tournament
    const addedPlayers = [];
    
    for (const player of result.storedPlayers) {
      // Check if player is already registered for this tournament
      const isRegistered = tournament.participants.some(
        p => p.player && p.player.toString() === player._id.toString()
      );
      
      if (!isRegistered) {
        // Add player to tournament
        tournament.participants.push({
          player: player._id,
          confirmed: true,
          paid: false,
          score: 0,
          tieBreak: 0
        });
        
        addedPlayers.push(player);
      }
    }
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      count: addedPlayers.length,
      data: {
        tournament,
        addedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('Error adding players to tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Upload players from file
router.post('/:id/players/upload', upload.single('playersFile'), async (req, res) => {
  try {
    console.log('Uploading players file for tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to upload players to any tournament
    
    const filePath = req.file.path;
    console.log('File uploaded to:', filePath);
    
    // Import our file processor and player data service
    const { processFile, cleanupFile } = require('../../lib/fileProcessor');
    const { processAndStorePlayerData } = require('../../lib/services/playerDataService');
    
    // Process the file to extract player data
    const fileData = await processFile(filePath);
    console.log('Extracted player data:', fileData);
    
    // Clean up the file after processing
    cleanupFile(filePath);
    
    if (fileData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid players found in the file'
      });
    }
    
    // Process and store the player data
    const result = await processAndStorePlayerData({
      fileData: fileData,
      storeInDatabase: true
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to process player data'
      });
    }
    
    // Add the stored players to the tournament
    const addedPlayers = [];
    
    for (const player of result.storedPlayers) {
      // Check if player is already registered for this tournament
      const isRegistered = tournament.participants.some(
        p => p.player && p.player.toString() === player._id.toString()
      );
      
      if (!isRegistered) {
        // Add player to tournament
        tournament.participants.push({
          player: player._id,
          confirmed: true,
          paid: false,
          score: 0,
          tieBreak: 0
        });
        
        addedPlayers.push(player);
      }
    }
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      count: addedPlayers.length,
      data: {
        tournament,
        addedPlayers,
        invalidPlayers: result.invalidPlayers,
        duplicates: result.duplicates
      }
    });
  } catch (error) {
    console.error('Error processing file and adding players:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Generate pairings for next round
router.post('/:id/pairings', async (req, res) => {
  try {
    console.log('Generating pairings for tournament:', req.params.id);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id)
      .populate('participants.player');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to generate pairings for any tournament
    
    // Check if tournament is active
    if (tournament.status !== 'active') {
      console.log('Tournament is not active, updating status to active');
      tournament.status = 'active';
      await tournament.save();
    }
    
    // Check if all matches from previous round are completed
    if (tournament.currentRound > 0) {
      const previousMatches = await Match.find({
        tournament: req.params.id,
        round: tournament.currentRound
      });
      
      const allCompleted = previousMatches.every(match => match.result !== '*');
      
      if (!allCompleted) {
        return res.status(400).json({
          success: false,
          error: 'All matches from the previous round must be completed'
        });
      }
    }
    
    // Check if we have enough participants
    if (!tournament.participants || tournament.participants.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Tournament needs at least 2 participants to generate pairings'
      });
    }
    
    // Filter out participants without player references
    const validParticipants = tournament.participants.filter(p => p.player && p.player._id);
    
    if (validParticipants.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Tournament needs at least 2 valid participants to generate pairings'
      });
    }
    
    // Increment current round
    tournament.currentRound += 1;
    
    // Check if tournament is complete
    if (tournament.currentRound > tournament.rounds) {
      tournament.status = 'completed';
      await tournament.save();
      
      return res.status(400).json({
        success: false,
        error: 'Tournament has reached the maximum number of rounds'
      });
    }
    
    console.log(`Generating pairings for round ${tournament.currentRound}`);
    
    // Create a map of player IDs to player objects for quick lookup
    const playerMap = new Map();
    validParticipants.forEach(p => {
      if (p.player && p.player._id) {
        playerMap.set(p.player._id.toString(), p.player);
      }
    });
    
    // Prepare players for pairing algorithm
    const players = validParticipants.map(p => ({
      id: p.player._id,
      name: `${p.player.firstName || ''} ${p.player.lastName || ''}`.trim(),
      score: p.score || 0,
      previousOpponents: [], // We'll populate this from previous matches
      colorHistory: [] // We'll populate this from previous matches
    }));
    
    console.log(`Prepared ${players.length} players for pairing`);
    
    // Get previous matches to determine previous opponents and color history
    const previousMatches = await Match.find({
      tournament: req.params.id,
      round: { $lt: tournament.currentRound }
    });
    
    console.log(`Found ${previousMatches.length} previous matches`);
    
    // Populate previous opponents and color history
    for (const match of previousMatches) {
      if (!match.whitePlayer || !match.blackPlayer) {
        console.log('Skipping match with missing players:', match);
        continue;
      }
      
      const whitePlayerIndex = players.findIndex(p => 
        p.id && match.whitePlayer && p.id.toString() === match.whitePlayer.toString()
      );
      
      const blackPlayerIndex = players.findIndex(p => 
        p.id && match.blackPlayer && p.id.toString() === match.blackPlayer.toString()
      );
      
      if (whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
        players[whitePlayerIndex].previousOpponents = players[whitePlayerIndex].previousOpponents || [];
        players[whitePlayerIndex].previousOpponents.push(match.blackPlayer);
        players[whitePlayerIndex].colorHistory = players[whitePlayerIndex].colorHistory || [];
        players[whitePlayerIndex].colorHistory.push('white');
        
        players[blackPlayerIndex].previousOpponents = players[blackPlayerIndex].previousOpponents || [];
        players[blackPlayerIndex].previousOpponents.push(match.whitePlayer);
        players[blackPlayerIndex].colorHistory = players[blackPlayerIndex].colorHistory || [];
        players[blackPlayerIndex].colorHistory.push('black');
      }
    }
    
    // Generate pairings
    const pairings = generateSwissPairings(players, tournament.currentRound);
    
    if (!pairings || pairings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Failed to generate pairings. Please check that you have enough players.'
      });
    }
    
    console.log(`Generated ${pairings.length} pairings`);
    
    // Create match documents
    const matches = [];
    
    for (const pairing of pairings) {
      if (!pairing.whitePlayer || !pairing.blackPlayer) {
        console.log('Skipping invalid pairing:', pairing);
        continue;
      }
      
      const match = await Match.create({
        tournament: tournament._id,
        round: tournament.currentRound,
        board: pairing.board,
        whitePlayer: pairing.whitePlayer,
        blackPlayer: pairing.blackPlayer,
        result: '*'
      });
      
      matches.push(match);
    }
    
    // Save tournament with updated current round
    await tournament.save();
    
    console.log('Pairings generated successfully:', matches.length);
    
    // Populate player data in the matches
    const populatedMatches = await Match.find({ tournament: tournament._id, round: tournament.currentRound })
      .populate('whitePlayer', 'firstName lastName chessRating')
      .populate('blackPlayer', 'firstName lastName chessRating');
    
    res.status(200).json({
      success: true,
      data: {
        tournament,
        matches: populatedMatches
      }
    });
  } catch (error) {
    console.error('Error generating pairings:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Record match result
router.put('/matches/:id', async (req, res) => {
  try {
    console.log('Recording match result for match:', req.params.id);
    console.log('Result:', req.body.result);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const { result } = req.body;
    
    // Convert frontend result format to database format
    let dbResult;
    switch (result) {
      case 'white':
        dbResult = '1-0';
        break;
      case 'black':
        dbResult = '0-1';
        break;
      case 'draw':
        dbResult = '1/2-1/2';
        break;
      default:
        dbResult = '*';
    }
    
    if (!['1-0', '0-1', '1/2-1/2', '*'].includes(dbResult)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid result'
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }
    
    // Get tournament with populated player data
    const tournament = await Tournament.findById(match.tournament)
      .populate('participants.player', 'firstName lastName chessRating');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing anyone to record match results
    
    // Check if the result is already set and is the same
    if (match.result === dbResult) {
      console.log('Match result already set to', dbResult);
      
      // Return the updated match with populated player data
      const updatedMatch = await Match.findById(req.params.id)
        .populate('whitePlayer', 'firstName lastName chessRating')
        .populate('blackPlayer', 'firstName lastName chessRating');
      
      return res.status(200).json({
        success: true,
        data: {
          match: updatedMatch,
          tournament: tournament
        }
      });
    }
    
    // Find player indices
    const whitePlayerIndex = tournament.participants.findIndex(
      p => p.player && p.player._id.toString() === match.whitePlayer.toString()
    );
    
    const blackPlayerIndex = tournament.participants.findIndex(
      p => p.player && p.player._id.toString() === match.blackPlayer.toString()
    );
    
    console.log('White player index:', whitePlayerIndex);
    console.log('Black player index:', blackPlayerIndex);
    
    // If the match already had a result, we need to revert the previous score changes
    if (match.result !== '*' && whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
      console.log('Reverting previous result:', match.result);
      
      // Revert previous result
      if (match.result === '1-0') {
        tournament.participants[whitePlayerIndex].score -= 1;
        tournament.participants[whitePlayerIndex].wins -= 1;
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      } else if (match.result === '0-1') {
        tournament.participants[blackPlayerIndex].score -= 1;
        tournament.participants[blackPlayerIndex].wins -= 1;
        if (match.blackPlayer) {
          tournament.participants[blackPlayerIndex].blackWins -= 1;
        }
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      } else if (match.result === '1/2-1/2') {
        tournament.participants[whitePlayerIndex].score -= 0.5;
        tournament.participants[blackPlayerIndex].score -= 0.5;
        // Revert other tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak -= 0.5;
        tournament.participants[blackPlayerIndex].tieBreak -= 0.5;
      }
    }
    
    // Update match result
    match.result = dbResult;
    await match.save();
    
    // Update player scores and tiebreaks
    if (dbResult !== '*' && whitePlayerIndex !== -1 && blackPlayerIndex !== -1) {
      console.log('Updating scores for white player index:', whitePlayerIndex, 'and black player index:', blackPlayerIndex);
      console.log('Before update - White player score:', tournament.participants[whitePlayerIndex].score, 
                 'Black player score:', tournament.participants[blackPlayerIndex].score);
      
      if (dbResult === '1-0') {
        // Main score
        tournament.participants[whitePlayerIndex].score += 1;
        // Wins count
        tournament.participants[whitePlayerIndex].wins += 1;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      } else if (dbResult === '0-1') {
        // Main score
        tournament.participants[blackPlayerIndex].score += 1;
        // Wins count
        tournament.participants[blackPlayerIndex].wins += 1;
        // Black wins
        tournament.participants[blackPlayerIndex].blackWins += 1;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      } else if (dbResult === '1/2-1/2') {
        // Main score
        tournament.participants[whitePlayerIndex].score += 0.5;
        tournament.participants[blackPlayerIndex].score += 0.5;
        // Tiebreaks
        tournament.participants[whitePlayerIndex].tieBreak += 0.5;
        tournament.participants[blackPlayerIndex].tieBreak += 0.5;
      }
      
      console.log('After update - White player score:', tournament.participants[whitePlayerIndex].score, 
                 'Black player score:', tournament.participants[blackPlayerIndex].score);
    } else {
      console.log('Could not find players in tournament participants. White player index:', whitePlayerIndex, 
                 'Black player index:', blackPlayerIndex);
    }
    
    // Calculate Buchholz and other tiebreaks
    await calculateTiebreaks(tournament);
    
    // Save the tournament with updated scores
    await tournament.save();
    
    // Get the updated tournament with populated participants
    const updatedTournament = await Tournament.findById(tournament._id)
      .populate('participants.player', 'firstName lastName chessRating');
    
    console.log('Tournament saved with updated scores');
    console.log('Updated tournament participants:', updatedTournament.participants.map(p => ({ 
      name: p.player ? `${p.player.firstName} ${p.player.lastName}` : 'null', 
      score: p.score,
      buchholz: p.buchholz,
      buchholzCut1: p.buchholzCut1,
      sonnebornBerger: p.sonnebornBerger,
      progressiveScore: p.progressiveScore,
      wins: p.wins,
      blackWins: p.blackWins
    })));
    
    // Return the updated match with populated player data
    const updatedMatch = await Match.findById(req.params.id)
      .populate('whitePlayer', 'firstName lastName chessRating')
      .populate('blackPlayer', 'firstName lastName chessRating');
    
    console.log('Match result recorded successfully');
    
    res.status(200).json({
      success: true,
      data: {
        match: updatedMatch,
        tournament: updatedTournament
      }
    });
  } catch (error) {
    console.error('Error recording match result:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

// Helper function to calculate tiebreaks for a tournament
async function calculateTiebreaks(tournament) {
  try {
    console.log('Calculating tiebreaks for tournament:', tournament._id);
    
    // Get all matches for this tournament
    const matches = await Match.find({ 
      tournament: tournament._id,
      result: { $ne: '*' } // Only completed matches
    });
    
    console.log(`Found ${matches.length} completed matches for tiebreak calculation`);
    
    // Create a map of player IDs to their opponents and results
    const playerOpponents = {};
    const playerScores = {};
    const playerWins = {};
    const playerBlackWins = {};
    
    // Initialize maps
    tournament.participants.forEach(participant => {
      if (participant.player) {
        const playerId = participant.player._id.toString();
        playerOpponents[playerId] = [];
        playerScores[playerId] = {
          roundScores: [],
          totalScore: 0
        };
        playerWins[playerId] = 0;
        playerBlackWins[playerId] = 0;
      }
    });
    
    // Process matches to build opponent lists and progressive scores
    matches.forEach(match => {
      if (!match.whitePlayer || !match.blackPlayer) return;
      
      const whiteId = match.whitePlayer.toString();
      const blackId = match.blackPlayer.toString();
      
      // Record opponents and results
      if (playerOpponents[whiteId]) {
        const whiteResult = match.result === '1-0' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerOpponents[whiteId].push({
          opponent: blackId,
          result: whiteResult
        });
        
        // Count wins
        if (whiteResult === 1) {
          playerWins[whiteId] = (playerWins[whiteId] || 0) + 1;
        }
      }
      
      if (playerOpponents[blackId]) {
        const blackResult = match.result === '0-1' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerOpponents[blackId].push({
          opponent: whiteId,
          result: blackResult
        });
        
        // Count wins and black wins
        if (blackResult === 1) {
          playerWins[blackId] = (playerWins[blackId] || 0) + 1;
          playerBlackWins[blackId] = (playerBlackWins[blackId] || 0) + 1;
        }
      }
      
      // Update progressive scores
      if (playerScores[whiteId]) {
        const roundScore = match.result === '1-0' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerScores[whiteId].roundScores[match.round - 1] = roundScore;
      }
      
      if (playerScores[blackId]) {
        const roundScore = match.result === '0-1' ? 1 : (match.result === '1/2-1/2' ? 0.5 : 0);
        playerScores[blackId].roundScores[match.round - 1] = roundScore;
      }
    });
    
    // Calculate progressive scores
    Object.keys(playerScores).forEach(playerId => {
      let runningTotal = 0;
      playerScores[playerId].progressiveScore = 0;
      
      playerScores[playerId].roundScores.forEach(score => {
        if (score !== undefined) {
          runningTotal += score;
          playerScores[playerId].progressiveScore += runningTotal;
        }
      });
      
      playerScores[playerId].totalScore = runningTotal;
    });
    
    // Calculate Buchholz and Sonneborn-Berger for each player
    tournament.participants.forEach((participant, index) => {
      if (!participant.player) return;
      
      const playerId = participant.player._id.toString();
      const opponents = playerOpponents[playerId] || [];
      
      // Reset tiebreak values
      participant.buchholz = 0;
      participant.buchholzCut1 = 0;
      participant.sonnebornBerger = 0;
      participant.progressiveScore = playerScores[playerId]?.progressiveScore || 0;
      participant.wins = playerWins[playerId] || 0;
      participant.blackWins = playerBlackWins[playerId] || 0;
      
      // Calculate Buchholz (sum of opponents' scores)
      if (opponents.length > 0) {
        // Get opponent scores
        const opponentScores = opponents.map(opp => {
          const oppIndex = tournament.participants.findIndex(
            p => p.player && p.player._id.toString() === opp.opponent
          );
          return oppIndex !== -1 ? tournament.participants[oppIndex].score : 0;
        });
        
        // Full Buchholz
        participant.buchholz = opponentScores.reduce((sum, score) => sum + score, 0);
        
        // Buchholz Cut 1 (remove lowest opponent score)
        if (opponentScores.length > 1) {
          const minScore = Math.min(...opponentScores);
          participant.buchholzCut1 = participant.buchholz - minScore;
        } else {
          participant.buchholzCut1 = participant.buchholz;
        }
        
        // Sonneborn-Berger (sum of scores of opponents defeated + half scores of opponents drawn)
        participant.sonnebornBerger = opponents.reduce((sum, opp) => {
          const oppIndex = tournament.participants.findIndex(
            p => p.player && p.player._id.toString() === opp.opponent
          );
          const oppScore = oppIndex !== -1 ? tournament.participants[oppIndex].score : 0;
          return sum + (oppScore * opp.result);
        }, 0);
      }
      
      console.log(`Player ${playerId} tiebreaks: Buchholz=${participant.buchholz}, BuchholzCut1=${participant.buchholzCut1}, SB=${participant.sonnebornBerger}, PS=${participant.progressiveScore}, Wins=${participant.wins}, BlackWins=${participant.blackWins}`);
    });
    
    console.log('Tiebreak calculation completed');
    
  } catch (error) {
    console.error('Error calculating tiebreaks:', error);
  }
}

// Remove player from tournament
router.delete('/:id/players/:playerId', async (req, res) => {
  try {
    console.log('Removing player from tournament:', req.params.id);
    console.log('Player ID:', req.params.playerId);
    console.log('User:', req.user ? req.user.id : 'No user');
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // IMPORTANT: Authorization check removed for testing
    // We're allowing any user to remove players from any tournament
    
    // Check if tournament is in registration phase
    if (tournament.status !== 'registration') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove players after tournament has started'
      });
    }
    
    // Find player in participants
    const playerIndex = tournament.participants.findIndex(
      p => p.player && p.player.toString() === req.params.playerId
    );
    
    if (playerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Player not found in tournament'
      });
    }
    
    // Remove player from participants
    tournament.participants.splice(playerIndex, 1);
    
    await tournament.save();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error removing player from tournament:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error: ' + error.message
    });
  }
});

module.exports = router; 