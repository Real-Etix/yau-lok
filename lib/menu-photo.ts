"use client";

// The menu photo lives in IndexedDB, not localStorage.
//
// A full-resolution photo of a 餐牌 is a couple of megabytes; as a data URL in
// localStorage it would blow the ~5 MB quota on the first shot and take the
// user's saved routes and settings down with it. IndexedDB stores the Blob
// itself, and the draft in localStorage only carries the key.

const DB = "yau-lok-photos";
const STORE = "menu";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMenuPhoto(blob: Blob): Promise<string> {
  const id = `menu-${Date.now()}`;
  await tx("readwrite", (s) => s.put(blob, id));
  return id;
}

export async function getMenuPhoto(id: string): Promise<Blob | null> {
  try {
    return (await tx<Blob | undefined>("readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteMenuPhoto(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* a photo we cannot delete is not worth failing an order over */
  }
}
