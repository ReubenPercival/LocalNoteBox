const Sync = {
  async push(serverUrl, passphrase) {
    const notes = await NotesDB.getAll();
    const encrypted = await CryptoUtils.encrypt(notes, passphrase);
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encrypted)
    });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    return res.json();
  },

  async pull(serverUrl, passphrase) {
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/sync`);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const encrypted = await res.json();
    if (!encrypted) return [];
    return CryptoUtils.decrypt(encrypted, passphrase);
  }
};
