/**
 * This module will generate a public and private keypair and save to current directory
 *
 * Make sure to save the private key elsewhere after generated!
 */
import { generateKeyPairSync } from "crypto";
import { writeFileSync } from "fs";
import path from "path";

function genKeyPair() {
  // Generates an object where the keys are stored in properties `privateKey` and `publicKey`
  const keyPair = generateKeyPairSync("rsa", {
    modulusLength: 4096, // bits - standard for RSA keys
    publicKeyEncoding: {
      type: "pkcs1", // "Public Key Cryptography Standards 1"
      format: "pem", // Most common formatting choice
    },
    privateKeyEncoding: {
      type: "pkcs1", // "Public Key Cryptography Standards 1"
      format: "pem", // Most common formatting choice
    },
  });

  // Create the public key file
  const currentDirectory = process.cwd();

  // Create the public key file in the current directory
  writeFileSync(
    path.join(currentDirectory, "id_rsa_pub.pem"),
    keyPair.publicKey
  );

  // Create the private key file in the current directory
  writeFileSync(
    path.join(currentDirectory, "id_rsa_priv.pem"),
    keyPair.privateKey
  );
}

// Generate the keypair
genKeyPair();
