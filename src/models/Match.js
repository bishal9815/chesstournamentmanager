const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  round: {
    type: Number,
    required: true
  },
  board: {
    type: Number,
    required: true
  },
  whitePlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  blackPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  result: {
    type: String,
    enum: ['1-0', '0-1', '1/2-1/2', '*'], // 1-0: white wins, 0-1: black wins, 1/2-1/2: draw, *: not played/in progress
    default: '*'
  },
  scheduledTime: {
    type: Date
  },
  completedTime: {
    type: Date
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure unique pairings within a tournament round
MatchSchema.index({ tournament: 1, round: 1, whitePlayer: 1, blackPlayer: 1 }, { unique: true });

// Ensure unique board assignments within a tournament round
MatchSchema.index({ tournament: 1, round: 1, board: 1 }, { unique: true });

module.exports = mongoose.model('Match', MatchSchema); 