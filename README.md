## Open App Builder Functions

Deployable functions to support specific open-app-builder deployment functionality

See example functions in [./functions](./functions/)

## QuickStart

Setup Environment Variables

```
cp .env.example .env
```

### Run Locally

**Send A Test Request**
Use any REST Client to send request to running endpoint, e.g.

```sh
POST http://127.0.0.1:5001/test/us-central1/myFunctionName
```

Alternatively put the request in a file with name ending `.http` and use [VSCode Rest Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension to call directly via the `send request` button that will appear in the file

**Firestore Seed Data**
Firestore will automatically clear any data generated during emulator use.
Data can however be exported and persisted for use in testing via

```sh
npm run emulators:export
```

### Deploy To Production

Login to firebase

Select your project and add (?)

## Creating Functions

See documentation at https://firebase.google.com/docs/functions

## TODOs

- [ ] Integrate into open-app-builder workflow to allow deployment to sync this repo at a given release version and deploy pre-configured functions
