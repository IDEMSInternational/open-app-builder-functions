# Open App Builder Functions

![Image: License](https://img.shields.io/github/license/IDEMSInternational/open-app-builder-functions)
![Image: Node Version](https://img.shields.io/badge/node-22.x-brightgreen)

## Overview

This repository contains deployable [Firebase Functions](https://firebase.google.com/docs/functions) that provide backend functionality for the Open App Builder ecosystem.

Deployable functions can be found in [./src](./src/)

## Preprequisites

- [Node.js](https://nodejs.org/) (version 22 recommended to match Firebase deployment)

It is recommended to use a Node version manager such as:

- [nvm](https://github.com/nvm-sh/nvm)
- [fnm](https://github.com/Schniz/fnm)

## QuickStart

1. Setup Environment Variables

```sh
cp .env.example .env
```

2. Install Dependencies

```sh
npm install
```

## Running Locally

Use start command to start the Firebase emulator suite and serve functions (with live-reload on change)

```sh
npm run start
```

- The emulator UI will be available at http://127.0.0.1:4000/
- Function endpoints will be available at http://127.0.0.1:5001/

## Testing Endpoints

Once running, a list of available function endpoints will appear in the console.

You can trigger functions by sending requests to the endpoints using any REST client.  
Recommended free and open-source options:

- [REST Client for VS Code](https://marketplace.visualstudio.com/itemName=humao.rest-client) – Send requests from .http files
- [Insomnia](https://insomnia.rest/) – Cross-platform graphical client
- [HTTPie](https://httpie.io/) – Command-line HTTP client

**Example request (VS Code REST Client)**

_my-request.http_

```
POST http://127.0.0.1:5001/test/us-central1/groupJoin
Content-Type: application/json
Authorization: Bearer <your_token>

{
"example": "data"
}
```

Open the file in VSCode and click the `Send Request` button that appears

**Example request (using cURL)**

```sh
curl -X POST http://127.0.0.1:5001/test/us-central1/groupJoin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{"example": "data"}'
```

## Deploying to Production

## 1. Review Environment Variables

Ensure all production environment variables are set as expected in ./env.

## 2. Link Firebase Project

Register a Firebase project (should be created in advance using the Firebase Console):

```sh
npm i -g firebase-tools
firebase login
firebase use --add
```

This will prompt you to select a project and specify an alias (useful for deploying to multiple projects).

See all available projects in .firebaserc. The active project can be changed via:

```sh
firebase use {alias}
```

## 3. Deploy

Deploy all functions:

```sh
firebase deploy
```

Deploy specific functions:

```sh
firebase deploy --only functions:myFunction1,functions:myFunction2
```

## Creating Functions

See the [Firebase Functions documentation](https://firebase.google.com/docs/functions) for guidance on creating and structuring new functions.

## Managing Seed Data

When running locally, firestore emulators will populate any data located in the `test/seed-data` directory on startup, but will not persist data across sessions (cleans up on exit)

If additional seed data should be included for all emulator runs, the current state of emulator data can be exported via

```sh
npm run emulators:export
```

Note that the data will be exported as a set of LevelDB files, which cannot be read as plain text (designed for internal use). As such changes to these files will have to be reviewed by viewing within the firestore emulators.

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements or new features.
