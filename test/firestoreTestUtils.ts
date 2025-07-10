import * as admin from "firebase-admin";
import { clearFirestoreData } from "firebase-functions-test/lib/providers/firestore";

// Represents a Firestore document, possibly with subcollections
type FirestoreDoc = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [field: string]: any;
  __collections__?: FirestoreCollections;
};

// Represents a Firestore collection: docId -> doc
type FirestoreCollection = {
  [docId: string]: FirestoreDoc;
};

// Represents all top-level collections: collectionName -> collection
type FirestoreCollections = {
  [collectionName: string]: FirestoreCollection;
};

// The root state type
type FirestoreSeedState = FirestoreCollections;

// Ensure firestore initialised
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export function getFirestoreEmulator() {
  return admin.firestore();
}

/** Seed Firestore with arbitrary mock data */
export async function seedFirestore(
  state: FirestoreSeedState,
  parentPath: string[] = []
) {
  const batch = admin.firestore().batch();

  // Helper to recursively add docs and subcollections
  function addDocs(collections: FirestoreCollections, path: string[]) {
    for (const [collectionName, collection] of Object.entries(collections)) {
      for (const [docId, doc] of Object.entries(collection)) {
        const { __collections__, ...fields } = doc;
        const docRef = admin
          .firestore()
          .doc([...path, collectionName, docId].join("/"));
        batch.set(docRef, fields);
        if (__collections__) {
          addDocs(__collections__, [...path, collectionName, docId]);
        }
      }
    }
  }

  addDocs(state, parentPath);
  await batch.commit();
}

/** Clear all Firestore data */
export async function clearFirestore() {
  // Use native emulator method for faster wipe (not available for seeding)
  return clearFirestoreData("test");
}
