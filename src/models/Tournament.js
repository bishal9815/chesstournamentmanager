const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a tournament name'],
    trim: true,
    maxlength: [100, 'Tournament name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please add an end date']
  },
  registrationDeadline: {
    type: Date
  },
  format: {
    type: String,
    enum: ['Swiss', 'Round Robin', 'Knockout', 'Team', 'Custom'],
    default: 'Swiss'
  },
  rounds: {
    type: Number,
    required: [true, 'Please add number of rounds'],
    min: [1, 'Rounds must be at least 1']
  },
  currentRound: {
    type: Number,
    default: 0
  },
  timeControl: {
    type: String,
    trim: true
  },
  maxParticipants: {
    type: Number,
    default: 0 // 0 means unlimited
  },
  entryFee: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['registration', 'active', 'completed', 'cancelled'],
    default: 'registration'
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [
    {
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      confirmed: {
        type: Boolean,
        default: false
      },
      paid: {
        type: Boolean,
        default: false
      },
      score: {
        type: Number,
        default: 0
      },
      // Tiebreak systems
      buchholzCut1: {
        type: Number,
        default: 0
      },
      buchholz: {
        type: Number,
        default: 0
      },
      sonnebornBerger: {
        type: Number,
        default: 0
      },
      progressiveScore: {
        type: Number,
        default: 0
      },
      directEncounter: {
        type: Number,
        default: 0
      },
      wins: {
        type: Number,
        default: 0
      },
      blackWins: {
        type: Number,
        default: 0
      },
      tieBreak: {
        type: Number,
        default: 0
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Populate participants when finding tournaments
TournamentSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'participants.player',
    select: 'firstName lastName email chessRating'
  }).populate({
    path: 'organizer',
    select: 'username email'
  });
  
  next();
});

module.exports = mongoose.model('Tournament', TournamentSchema); 