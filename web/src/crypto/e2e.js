// End-to-end encryption for Direct Messages
// Protocol: ECDH key exchange → derive AES-256-GCM shared secret → encrypt messages
// Server stores only ciphertext + IV. Never sees plaintext.

const ECDH_PARAMS  = { name: 'ECDH', namedCurve: 'P-256' };
const AES_PARAMS   = { name: 'AES-GCM', length: 256 };
const HKDF_PARAMS  = { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('ZEnode-DM-v1') };

// Generate a new ECDH keypair for this user
export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey']);
  const publicJwk  = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk, privateJwk };
}

// Import a JWK public key from another user
async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, []);
}

// Import our stored private key
async function importPrivateKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, ECDH_PARAMS, true, ['deriveKey']);
}

// Derive shared AES key from our private + their public
async function deriveSharedKey(myPrivateJwk, theirPublicJwk) {
  const myPrivate   = await importPrivateKey(myPrivateJwk);
  const theirPublic = await importPublicKey(theirPublicJwk);
  const rawShared = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    AES_PARAMS,
    false,
    ['encrypt', 'decrypt']
  );
  return rawShared;
}

// Encrypt a plaintext message for a recipient
export async function encryptMessage(plaintext, myPrivateJwk, theirPublicJwk) {
  const sharedKey = await deriveSharedKey(myPrivateJwk, theirPublicJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, encoded);
  return {
    encryptedContent: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

// Decrypt a message from a sender
export async function decryptMessage(encryptedContent, ivB64, myPrivateJwk, senderPublicJwk) {
  try {
    const sharedKey = await deriveSharedKey(myPrivateJwk, senderPublicJwk);
    const iv         = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sharedKey, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return '[🔒 Unable to decrypt]';
  }
}

// Persist keys in localStorage (in production: use IndexedDB + passphrase wrapping)
export function saveKeys(userId, keys) {
  localStorage.setItem(`ze_keys_${userId}`, JSON.stringify(keys));
}

export function loadKeys(userId) {
  try { return JSON.parse(localStorage.getItem(`ze_keys_${userId}`)); } catch { return null; }
}
