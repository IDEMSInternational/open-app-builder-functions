## Open App Builder Functions

Deployable functions to support specific open-app-builder deployment functionality

See example functions in [./src](./src/)

## Prerequisites

- [Node.js](https://nodejs.org/) (version 22 recommended to match firebase deployment)

it is recommended to use a node version manager such as [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm) to handle switching between different node versions

## QuickStart

Setup Environment Variables

```sh
cp .env.example .env
```

Install dependencies

```sh
npm install
```

### Run Locally

```sh
npm run start
```

This will start the firebase emulator suite to mimic production function endpoints and services such as firestore database

An interactive console will be available to view resource at http://127.0.0.1:4000/

**Send A Test Request**
Once running, a list of available function endpoints will appear in the console.
Functions will be triggered by sending requests to the endpoint using REST client such as [Insomnia](https://insomnia.rest/) or command line.

```
POST http://127.0.0.1:5001/test/us-central1/groupJoin
```

Alternatively, If using VSCode and the [VSCode Rest Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension,
requests can be defined in files ending `.http` and triggered via the interactive `send request` button that will appear in the file

## Deploy To Production

**Review Environment Variables**
Ensure all production environment variables are set as expected in `./env`

**Link Firebase Project**
Register a firebase project (should be created in advance using firebase console)

```sh
npm i -g firebase tools
firebase login
firebase use --add
```

This will prompt for a project to use and alias to specify (if wanting to deploy to multiple projects)
See all available projects in `.firebaserc`. The active project can changed via:

```sh
firebase use {alias}
```

**Deploy**
Functions can be deployed via

```sh
firebase deploy
```

By default this will deploy all functions. Individual functions can also be specified

```sh
firebase deploy --only functions:myFunction1,functions:myFunction2
```

## Creating Functions

See documentation at https://firebase.google.com/docs/functions

## Managing Seed Data

Firestore will automatically clear any data generated during emulator use.
Data can however be exported and persisted for use in testing via

```sh
npm run emulators:export
```
