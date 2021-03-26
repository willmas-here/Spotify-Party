const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const database = admin.database();

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// createParty
exports.createParty = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated",
        "The function must be called while authenticated");
  }

  const attributesPromise = database.ref("parties/attributes/").get();
  const userPromise = database.ref("users/")
      .child(context.auth.uid).child("displayName").get();

  let [parties, userDisplayName] = await Promise.all(
      [attributesPromise, userPromise],
  );
  userDisplayName = userDisplayName.val();

  let validCode = false;
  let partyCode = 0;

  while (!validCode) {
    partyCode = Math.floor(Math.random() * (1000000-100000) + 100000);

    if (!parties.child(partyCode).exists()) {
      validCode = true;
    }
  }

  functions.logger.info("Party Code = " + partyCode);

  const attributes = {
    "host": context.auth.uid,
    "permissions": {
      "change_queue": "everybody",
      "change_state": "everybody",
    },
    "time_created": Date.now(),
  };

  const state = {
    "status": "pause",
    "current_index": "0",
    "current_loc": "0",
  };

  const users = {
    [context.auth.uid]: {
      "displayName": userDisplayName,
    },
  };

  try {
    await Promise.all([
      database.ref("parties/users/").child(partyCode).set(users),
      database.ref("parties/attributes/").child(partyCode).set(attributes),
      database.ref("parties/queues/").child(partyCode).set(true),
      database.ref("parties/state/").child(partyCode).set(state),
    ]);
    return {
      "partyCode": partyCode,
    };
  } catch (err) {
    functions.logger.error(err);
    throw new functions.https.HttpsError("aborted",
        "Internal error while creating party", err);
  }
});

// joinParty
exports.joinParty = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated",
        "The function must be called while authenticated");
  }

  const attributesPromise = database.ref("parties/attributes/").get();
  const userPromise = database.ref("users/")
      .child(context.auth.uid).child("displayName").get();

  let [parties, userDisplayName] = await Promise.all(
      [attributesPromise, userPromise],
  );
  userDisplayName = userDisplayName.val();

  if (typeof(data.partyCode) !== "number") {
    throw new functions.https.HttpsError("invalid-argument",
        "The party code argument type must be a number");
  }
  if (data.partyCode.toString().length !== 6) {
    throw new functions.https.HttpsError("out-of-range",
        "The party code must be 6 digits long");
  }
  if (!parties.child(data.partyCode).exists()) {
    throw new functions.https.HttpsError("not-found",
        "This Party does not exist");
  }

  try {
    database.ref("parties/users/").child(data.partyCode).child(context.auth.uid)
        .set({"displayName": userDisplayName});
    return {
      "partyCode": data.partyCode,
    };
  } catch (err) {
    throw new functions.https.HttpsError("internal",
        "An error occured while updating the database");
  }
});

// create user

// billing
