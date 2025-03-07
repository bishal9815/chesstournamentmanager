# Chess Tournament Manager

A web application for managing chess tournaments with automated player pairing and results tracking.

## Features

- **User Authentication**: Register, login, and manage user profiles
- **Tournament Creation**: Create and configure chess tournaments
- **Player Management**: Register players for tournaments
- **Automated Pairing**: Swiss-system pairing algorithm for fair matchups
- **Results Tracking**: Record and track match results
- **Standings & Statistics**: View tournament standings and player statistics
- **Admin Dashboard**: Manage tournaments, players, and settings

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: MongoDB
- Authentication: JWT (JSON Web Tokens)
- Pairing Algorithm: Custom implementation of Swiss-system

## Project Structure

```
chess-tournament-manager/
├── src/
│   ├── app/              # Main application pages
│   ├── components/       # Reusable UI components
│   ├── lib/              # Utility functions and helpers
│   ├── models/           # Data models and schemas
│   └── styles/           # CSS and styling files
├── public/               # Static assets
│   └── images/           # Image assets
└── README.md             # Project documentation
```

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables
4. Start the development server: `npm run dev`
5. Access the application at `http://localhost:3000`

## License

MIT 