// Web Push crypto utilities for Deno Edge Functions
// Implements the Web Push protocol using Web Crypto API

const encoder = new TextEncoder();

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToUrlBase64(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length > 0 ? salt : new Uint8Array(32)));
  
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = concatUint8Arrays(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
  
  return okm.slice(0, length);
}

function createInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const typeLen = typeBytes.length;
  
  // "Content-Encoding: <type>\0" + P-256 + \0 + len(receiver) + receiver + len(sender) + sender
  const header = encoder.encode("Content-Encoding: ");
  const nul = new Uint8Array([0]);
  const p256 = encoder.encode("P-256");
  
  const clientLen = new Uint8Array(2);
  clientLen[0] = 0;
  clientLen[1] = clientPublicKey.length;
  
  const serverLen = new Uint8Array(2);
  serverLen[0] = 0;
  serverLen[1] = serverPublicKey.length;
  
  return concatUint8Arrays(
    header, typeBytes, nul, p256, nul,
    clientLen, clientPublicKey,
    serverLen, serverPublicKey
  );
}

async function encryptPayload(
  clientPublicKeyStr: string,
  clientAuthStr: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKey = urlBase64ToUint8Array(clientPublicKeyStr);
  const clientAuth = urlBase64ToUint8Array(clientAuthStr);
  
  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );
  
  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256
    )
  );
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Create info for auth and content encryption
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkeyInfo = createInfo("aesgcm", clientPublicKey, serverPublicKeyRaw);
  const nonceInfo = createInfo("nonce", clientPublicKey, serverPublicKeyRaw);
  
  // Derive PRK from auth secret
  const prk = await hkdf(clientAuth, sharedSecret, authInfo, 32);
  
  // Derive content encryption key and nonce
  const contentEncryptionKey = await hkdf(salt, prk, prkeyInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);
  
  // Pad and encrypt payload
  const payloadBytes = encoder.encode(payload);
  const paddingLength = 0;
  const paddedPayload = concatUint8Arrays(
    new Uint8Array([0, paddingLength]),
    payloadBytes
  );
  
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      paddedPayload
    )
  );
  
  return { ciphertext: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: "mailto:info@washero.ar",
  };
  
  const headerB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import VAPID private key
  const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);
  const publicKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
  
  // Build JWK from raw keys
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToUrlBase64(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToUrlBase64(publicKeyBytes.slice(33, 65)),
    d: vapidPrivateKey,
  };
  
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signatureRaw = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      encoder.encode(unsignedToken)
    )
  );
  
  // Convert DER signature to raw r||s format (already in raw format from Web Crypto)
  const signatureB64 = uint8ArrayToUrlBase64(signatureRaw);
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  return {
    authorization: `WebPush ${jwt}`,
    cryptoKey: `p256ecdsa=${vapidPublicKey}`,
  };
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  endpoint: string;
  success: boolean;
  status?: number;
  error?: string;
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<PushResult> {
  try {
    const payloadStr = JSON.stringify(payload);
    
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      subscription.p256dh,
      subscription.auth,
      payloadStr
    );
    
    const { authorization, cryptoKey } = await createVapidAuthHeader(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey
    );
    
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aesgcm",
        "Encryption": `salt=${uint8ArrayToUrlBase64(salt)}`,
        "Crypto-Key": `dh=${uint8ArrayToUrlBase64(serverPublicKey)};${cryptoKey}`,
        Authorization: authorization,
        TTL: "86400",
        Urgency: "high",
      },
      body: ciphertext,
    });
    
    const body = await response.text();
    
    if (response.status === 201 || response.status === 200) {
      return { endpoint: subscription.endpoint, success: true, status: response.status };
    }
    
    return {
      endpoint: subscription.endpoint,
      success: false,
      status: response.status,
      error: body || `HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: error.message,
    };
  }
}
