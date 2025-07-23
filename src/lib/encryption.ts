// End-to-end encryption utilities using Web Crypto API
class E2EEncryption {
  private keyCache = new Map<string, CryptoKey>();

  // Generate a new encryption key pair for a conversation
  async generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Generate symmetric key for message encryption
  async generateSymmetricKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Export key to be stored/shared
  async exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('jwk', key);
    return JSON.stringify(exported);
  }

  // Import key from stored format
  async importKey(keyData: string, keyType: 'encrypt' | 'decrypt' = 'encrypt'): Promise<CryptoKey> {
    const keyObj = JSON.parse(keyData);
    
    if (keyObj.kty === 'RSA') {
      return await window.crypto.subtle.importKey(
        'jwk',
        keyObj,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        keyType === 'encrypt' ? ['encrypt'] : ['decrypt']
      );
    } else {
      return await window.crypto.subtle.importKey(
        'jwk',
        keyObj,
        {
          name: 'AES-GCM',
        },
        true,
        ['encrypt', 'decrypt']
      );
    }
  }

  // Encrypt message content
  async encryptMessage(message: string, conversationId: string): Promise<{
    encryptedContent: string;
    encryptionKeyId: string;
  }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // Generate or get symmetric key for this conversation
    let symmetricKey = this.keyCache.get(conversationId);
    if (!symmetricKey) {
      symmetricKey = await this.generateSymmetricKey();
      this.keyCache.set(conversationId, symmetricKey);
    }

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the message
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      symmetricKey,
      data
    );

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(iv.length + encrypted.byteLength);
    encryptedArray.set(iv);
    encryptedArray.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64 for storage
    const encryptedContent = btoa(String.fromCharCode(...encryptedArray));
    const encryptionKeyId = await this.exportKey(symmetricKey);

    return {
      encryptedContent,
      encryptionKeyId: btoa(encryptionKeyId) // Store key ID as base64
    };
  }

  // Decrypt message content
  async decryptMessage(encryptedContent: string, encryptionKeyId: string): Promise<string> {
    try {
      // Decode the encryption key
      const keyData = atob(encryptionKeyId);
      const symmetricKey = await this.importKey(keyData);

      // Decode the encrypted content
      const encryptedArray = new Uint8Array(
        atob(encryptedContent)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV (first 12 bytes) and encrypted data
      const iv = encryptedArray.slice(0, 12);
      const encrypted = encryptedArray.slice(12);

      // Decrypt the message
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        symmetricKey,
        encrypted
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '[Encrypted Message - Unable to decrypt]';
    }
  }

  // Clear cached keys (e.g., on logout)
  clearKeyCache(): void {
    this.keyCache.clear();
  }
}

export const encryption = new E2EEncryption();