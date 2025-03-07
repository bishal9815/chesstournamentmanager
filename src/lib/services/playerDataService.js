/**
 * Player Data Service
 * 
 * A comprehensive service for processing player data from various sources
 * (manual input, file uploads, Chess.com API) with validation, normalization,
 * deduplication, and storage.
 */

const { validatePlayer, validatePlayers } = require('../validation/playerValidation');
const { normalizePlayer, normalizePlayers } = require('../normalization/playerNormalization');
const { deduplicatePlayers } = require('../deduplication/playerDeduplication');
const { getPlayerInfo, batchGetPlayerInfo } = require('../chessComApi');
const User = require('../../models/User');
const Player = require('../../models/Player');

/**
 * Process player data from manual input
 * 
 * @param {Array<Object>} players - Array of player objects from manual input
 * @returns {Promise<Object>} - Processing results
 */
async function processManualPlayerData(players) {
  // Validate input
  if (!Array.isArray(players) || players.length === 0) {
    return {
      success: false,
      error: 'No valid player data provided',
      processedPlayers: [],
      invalidPlayers: [],
      duplicates: []
    };
  }
  
  // Step 1: Normalize the data
  const normalizedPlayers = normalizePlayers(players);
  
  // Step 2: Validate the normalized data
  const validationResult = validatePlayers(normalizedPlayers);
  
  if (validationResult.validPlayers.length === 0) {
    return {
      success: false,
      error: 'No valid players after validation',
      processedPlayers: [],
      invalidPlayers: validationResult.invalidPlayers,
      duplicates: []
    };
  }
  
  // Step 3: Enhance with Chess.com data if usernames are provided
  const playersWithChesscomData = await enhanceWithChesscomData(validationResult.validPlayers);
  
  // Step 4: Deduplicate the players
  const { deduplicatedPlayers, duplicateGroups } = deduplicatePlayers(playersWithChesscomData);
  
  return {
    success: true,
    processedPlayers: deduplicatedPlayers,
    invalidPlayers: validationResult.invalidPlayers,
    duplicates: duplicateGroups
  };
}

/**
 * Process player data from file upload
 * 
 * @param {Array<Object>} fileData - Array of player objects from file upload
 * @returns {Promise<Object>} - Processing results
 */
async function processFilePlayerData(fileData) {
  // Validate input
  if (!Array.isArray(fileData) || fileData.length === 0) {
    return {
      success: false,
      error: 'No valid player data found in file',
      processedPlayers: [],
      invalidPlayers: [],
      duplicates: []
    };
  }
  
  // The processing steps are the same as for manual data
  return processManualPlayerData(fileData);
}

/**
 * Enhance player data with Chess.com information
 * 
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Array<Object>>} - Enhanced player objects
 */
async function enhanceWithChesscomData(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  // Extract players with Chess.com usernames
  const playersWithUsernames = players.filter(p => p.chesscomUsername);
  
  if (playersWithUsernames.length === 0) {
    return players; // No usernames to look up
  }
  
  try {
    // Get usernames to look up
    const usernames = playersWithUsernames.map(p => p.chesscomUsername);
    
    // Fetch Chess.com data
    const chesscomData = await batchGetPlayerInfo(usernames);
    
    // Create a map for quick lookup
    const chesscomDataMap = new Map();
    chesscomData.forEach(data => {
      chesscomDataMap.set(data.username.toLowerCase(), data);
    });
    
    // Enhance player data
    return players.map(player => {
      if (!player.chesscomUsername) {
        return player;
      }
      
      const chesscomInfo = chesscomDataMap.get(player.chesscomUsername.toLowerCase());
      
      if (!chesscomInfo) {
        return player;
      }
      
      // Use Chess.com name if player name is empty or just username-like
      let name = player.name;
      if (chesscomInfo.name && 
          (!player.name || 
           player.name.toLowerCase() === player.chesscomUsername.toLowerCase())) {
        name = chesscomInfo.name;
      }
      
      // Use Chess.com rating if player doesn't have one or Chess.com rating is higher
      const rating = !player.rating || (chesscomInfo.rating > player.rating) ? 
        chesscomInfo.rating : player.rating;
      
      return {
        ...player,
        name,
        rating,
        chesscomData: chesscomInfo
      };
    });
  } catch (error) {
    console.error('Error enhancing with Chess.com data:', error);
    return players; // Return original players if there's an error
  }
}

/**
 * Store processed player data in the database
 * 
 * @param {Array<Object>} players - Array of processed player objects
 * @returns {Promise<Array<Object>>} - Stored player objects
 */
async function storePlayerData(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  const storedPlayers = [];
  
  for (const playerData of players) {
    try {
      // Check if player already exists in the database
      let player = null;
      
      // Try to find by email first (most reliable identifier)
      if (playerData.email) {
        player = await User.findOne({ email: playerData.email });
      }
      
      // If not found by email, try Chess.com username
      if (!player && playerData.chesscomUsername) {
        player = await User.findOne({ chesscomUsername: playerData.chesscomUsername });
      }
      
      // If player exists, update their information
      if (player) {
        // Update player data, but don't overwrite existing data with empty values
        const updates = {};
        
        if (playerData.name && (!player.firstName || !player.lastName)) {
          // Split name into first and last name
          const nameParts = playerData.name.split(' ');
          updates.firstName = nameParts[0] || player.firstName || '';
          updates.lastName = nameParts.slice(1).join(' ') || player.lastName || '';
        }
        
        if (playerData.rating && (!player.chessRating || player.chessRating < playerData.rating)) {
          updates.chessRating = playerData.rating;
        }
        
        if (playerData.chesscomUsername && !player.chesscomUsername) {
          updates.chesscomUsername = playerData.chesscomUsername;
        }
        
        if (playerData.chesscomData && !player.chesscomData) {
          updates.chesscomData = playerData.chesscomData;
        }
        
        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
          player = await User.findByIdAndUpdate(
            player._id,
            updates,
            { new: true }
          );
        }
      } else {
        // Create a new player
        const nameParts = playerData.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Generate a username from email or name
        let username = '';
        if (playerData.email) {
          username = playerData.email.split('@')[0];
        } else if (playerData.chesscomUsername) {
          username = playerData.chesscomUsername;
        } else {
          username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;
        }
        
        // Generate a random password
        const password = Math.random().toString(36).slice(-8);
        
        player = await User.create({
          username,
          email: playerData.email || `${username}@temp.com`,
          password,
          firstName,
          lastName,
          chessRating: playerData.rating || 1200,
          chesscomUsername: playerData.chesscomUsername || '',
          chesscomData: playerData.chesscomData || null,
          role: 'user'
        });
      }
      
      storedPlayers.push(player);
    } catch (error) {
      console.error('Error storing player:', error);
      // Continue with next player
    }
  }
  
  return storedPlayers;
}

/**
 * Store players directly without processing
 * @param {Array<Object>} players - Array of player objects
 * @returns {Promise<Array<Object>>} - Array of stored player objects
 */
async function storePlayersDirectly(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }
  
  const storedPlayers = [];
  const Player = require('../../models/Player');
  
  for (const playerData of players) {
    try {
      console.log('Directly storing player:', playerData);
      
      // Create new player
      const player = await Player.create({
        firstName: playerData.firstName || '',
        lastName: playerData.lastName || '',
        email: playerData.email || '',
        chessRating: playerData.chessRating || playerData.rating || null
      });
      
      storedPlayers.push(player);
    } catch (error) {
      console.error('Error directly storing player:', error);
    }
  }
  
  return storedPlayers;
}

/**
 * Process and store player data from multiple sources
 * 
 * @param {Object} options - Processing options
 * @param {Array<Object>} options.manualData - Player data from manual input
 * @param {Array<Object>} options.fileData - Player data from file upload
 * @param {boolean} options.storeInDatabase - Whether to store the processed data
 * @returns {Promise<Object>} - Processing results
 */
async function processAndStorePlayerData({ manualData = [], fileData = [], storeInDatabase = true }) {
  try {
    console.log('Processing player data:', { 
      manualDataLength: manualData ? manualData.length : 0, 
      fileDataLength: fileData ? fileData.length : 0 
    });
    
    // Handle case where data is passed directly without specifying manualData or fileData
    if (Array.isArray(manualData) && manualData.length > 0) {
      console.log('Processing manual data:', manualData);
    } else if (Array.isArray(fileData) && fileData.length > 0) {
      console.log('Processing file data:', fileData);
    } else {
      console.log('No valid player data provided');
      return {
        success: false,
        error: 'No valid player data provided'
      };
    }
    
    // Remove duplicates from input data
    const { removeDuplicatePlayers } = require('../fileProcessor');
    
    if (Array.isArray(manualData) && manualData.length > 0) {
      manualData = removeDuplicatePlayers(manualData);
      console.log(`After removing duplicates: ${manualData.length} manual players`);
    }
    
    if (Array.isArray(fileData) && fileData.length > 0) {
      fileData = removeDuplicatePlayers(fileData);
      console.log(`After removing duplicates: ${fileData.length} file players`);
    }
    
    // Convert data to the expected format if needed
    const normalizedManualData = Array.isArray(manualData) ? manualData.map(player => {
      // If the player has firstName/lastName but not name, create a name
      if (!player.name && (player.firstName || player.lastName)) {
        return {
          ...player,
          name: `${player.firstName || ''} ${player.lastName || ''}`.trim()
        };
      }
      return player;
    }) : [];
    
    const normalizedFileData = Array.isArray(fileData) ? fileData.map(player => {
      // If the player has firstName/lastName but not name, create a name
      if (!player.name && (player.firstName || player.lastName)) {
        return {
          ...player,
          name: `${player.firstName || ''} ${player.lastName || ''}`.trim()
        };
      }
      return player;
    }) : [];
    
    // Process manual data
    const manualResult = normalizedManualData.length > 0 ? 
      await processManualPlayerData(normalizedManualData) : 
      { success: true, processedPlayers: [], invalidPlayers: [], duplicates: [] };
    
    // Process file data
    const fileResult = normalizedFileData.length > 0 ? 
      await processFilePlayerData(normalizedFileData) : 
      { success: true, processedPlayers: [], invalidPlayers: [], duplicates: [] };
    
    // Combine the results
    const allProcessedPlayers = [
      ...manualResult.processedPlayers,
      ...fileResult.processedPlayers
    ];
    
    const allInvalidPlayers = [
      ...manualResult.invalidPlayers,
      ...fileResult.invalidPlayers
    ];
    
    console.log('Processed players:', allProcessedPlayers.length);
    console.log('Invalid players:', allInvalidPlayers.length);
    
    // If no valid players, return error
    if (allProcessedPlayers.length === 0) {
      // If we have invalid players, try to use them directly
      if (allInvalidPlayers.length > 0 || normalizedManualData.length > 0 || normalizedFileData.length > 0) {
        console.log('No valid players after processing, using original data');
        
        // Use the original data directly
        const directPlayers = [
          ...normalizedManualData,
          ...normalizedFileData,
          ...allInvalidPlayers.map(p => p.originalData)
        ].filter(Boolean);
        
        if (directPlayers.length === 0) {
          return {
            success: false,
            error: 'No valid players found after processing',
            processedPlayers: [],
            storedPlayers: [],
            invalidPlayers: allInvalidPlayers,
            duplicates: []
          };
        }
        
        // Remove duplicates again
        const uniqueDirectPlayers = removeDuplicatePlayers(directPlayers);
        console.log(`After removing duplicates: ${uniqueDirectPlayers.length} direct players`);
        
        // Store players directly
        const storedPlayers = await storePlayersDirectly(uniqueDirectPlayers);
        
        return {
          success: true,
          processedPlayers: uniqueDirectPlayers,
          storedPlayers,
          invalidPlayers: [],
          duplicates: []
        };
      }
      
      return {
        success: false,
        error: 'No valid players found after processing',
        processedPlayers: [],
        storedPlayers: [],
        invalidPlayers: allInvalidPlayers,
        duplicates: []
      };
    }
    
    // Deduplicate the combined results
    const { deduplicatedPlayers, duplicateGroups } = deduplicatePlayers(allProcessedPlayers);
    
    // Store in database if requested
    let storedPlayers = [];
    if (storeInDatabase && deduplicatedPlayers.length > 0) {
      try {
        console.log('Storing players in database:', deduplicatedPlayers.length);
        
        const Player = require('../../models/Player');
        
        for (const playerData of deduplicatedPlayers) {
          try {
            console.log('Storing player:', playerData);
            
            // Extract firstName and lastName from name if needed
            let firstName = playerData.firstName || '';
            let lastName = playerData.lastName || '';
            
            if (playerData.name && (!firstName || !lastName)) {
              const nameParts = playerData.name.split(' ');
              firstName = firstName || nameParts[0] || '';
              lastName = lastName || nameParts.slice(1).join(' ') || '';
            }
            
            // Check if player already exists
            let player = null;
            
            if (firstName && lastName) {
              player = await Player.findOne({
                firstName,
                lastName
              });
            } else if (playerData.email) {
              player = await Player.findOne({ email: playerData.email });
            }
            
            if (player) {
              console.log('Player already exists:', player);
              
              // Update existing player
              if (playerData.chessRating && (!player.chessRating || playerData.chessRating > player.chessRating)) {
                player.chessRating = playerData.chessRating;
              }
              
              if (playerData.email && !player.email) {
                player.email = playerData.email;
              }
              
              await player.save();
              
              storedPlayers.push(player);
            } else {
              // Create new player
              player = await Player.create({
                firstName: firstName || '',
                lastName: lastName || '',
                email: playerData.email || '',
                chessRating: playerData.chessRating || playerData.rating || null
              });
              
              storedPlayers.push(player);
            }
          } catch (error) {
            console.error('Error storing player:', error);
            allInvalidPlayers.push({
              ...playerData,
              reason: 'Database error: ' + error.message
            });
          }
        }
      } catch (error) {
        console.error('Error storing players:', error);
      }
    }
    
    console.log('Stored players:', storedPlayers.length);
    
    return {
      success: true,
      processedPlayers: deduplicatedPlayers,
      storedPlayers,
      invalidPlayers: allInvalidPlayers,
      duplicates: duplicateGroups
    };
  } catch (error) {
    console.error('Error processing player data:', error);
    return {
      success: false,
      error: `Error processing player data: ${error.message}`,
      processedPlayers: [],
      storedPlayers: [],
      invalidPlayers: [],
      duplicates: []
    };
  }
}

module.exports = {
  processManualPlayerData,
  processFilePlayerData,
  enhanceWithChesscomData,
  storePlayerData,
  storePlayersDirectly,
  processAndStorePlayerData
}; 