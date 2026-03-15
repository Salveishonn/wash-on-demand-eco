// Web Push encryption — RFC 8291 (aes128gcm)
// Pure Web Crypto API implementation for Deno Edge Functions

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

// HKDF-Extract: PRK = HMAC-SHA-256(salt, ikm) — salt is the HMAC key
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const effectiveSalt = salt.length > 0 ? salt : new Uint8Array(32);
  const key = await crypto.subtle.importKey(
    "raw", effectiveSalt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

// HKDF-Expand: OKM = first `length` bytes of T(1)
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const infoWithCounter = concatUint8Arrays(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", key, infoWithCounter));
  return okm.slice(0, length);
}

async function encryptPayload(
  clientPublicKeyStr: string,
  clientAuthStr: string,
  payload: string
): Promise<Uint8Array> {
  const clientPublicKey = urlBase64ToUint8Array(clientPublicKeyStr);
  const clientAuth = urlBase64ToUint8Array(clientAuthStr);

  // 1. Generate ephemeral server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // 2. Import client public key and derive shared secret
  const clientKey = await crypto.subtle.importKey(
    "raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey }, serverKeyPair.privateKey, 256
    )
  );

  // 3. Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 4. RFC 8291 key derivation
  // 4a. IKM from auth secret
  const keyInfoAuth = concatUint8Arrays(
    encoder.encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKeyRaw
  );
  const prkAuth = await hkdfExtract(clientAuth, sharedSecret);
  const ikm = await hkdfExpand(prkAuth, keyInfoAuth, 32);

  // 4b. Content encryption key and nonce from salt
  const prk = await hkdfExtract(salt, ikm);
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const cek = await hkdfExpand(prk, cekInfo, 16);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // 5. Encrypt with AES-128-GCM
  // For aes128gcm last record: plaintext + \x02 delimiter
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = concatUint8Arrays(payloadBytes, new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey(
    "raw", cek, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload)
  );

  // 6. Build aes128gcm body:
  //    salt (16) || rs (4, big-endian) || idlen (1) || keyid (65 = server pub key) || ciphertext
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);
  const idLen = new Uint8Array([serverPublicKeyRaw.length]);

  return concatUint8Arrays(salt, rsBytes, idLen, serverPublicKeyRaw, encrypted);
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: "mailto:info@washero.ar",
  };

  const headerB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(header)));
  const claimsB64 = uint8ArrayToUrlBase64(encoder.encode(JSON.stringify(claims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Import VAPID private key as JWK
  const publicKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToUrlBase64(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToUrlBase64(publicKeyBytes.slice(33, 65)),
    d: vapidPrivateKey,
  };

  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  const signatureRaw = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsignedToken)
    )
  );

  const signatureB64 = uint8ArrayToUrlBase64(signatureRaw);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return `vapid t=${jwt}, k=${vapidPublicKey}`;
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
    const body = await encryptPayload(subscription.p256dh, subscription.auth, payloadStr);
    const authorization = await createVapidAuthHeader(subscription.endpoint, vapidPublicKey, vapidPrivateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: authorization,
        TTL: "86400",
        Urgency: "high",
      },
      body,
    });

    const responseBody = await response.text();

    if (response.status === 201 || response.status === 200) {
      return { endpoint: subscription.endpoint, success: true, status: response.status };
    }

    console.error(`[webPush] Failed: ${response.status} ${responseBody}`);
    return {
      endpoint: subscription.endpoint,
      success: false,
      status: response.status,
      error: responseBody || `HTTP ${response.status}`,
    };
  } catch (error: any) {
    console.error(`[webPush] Exception: ${error.message}`);
    return {
      endpoint: subscription.endpoint,
      success: false,
      error: error.message,
    };
  }
}
