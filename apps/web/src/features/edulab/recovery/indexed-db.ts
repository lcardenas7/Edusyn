import type { DomainEvent } from '@edusyn/edulab-runtime'
import { outboxRecords, type LocalAttemptRecord, type OutboxRecord } from './recovery'

const DATABASE_NAME = 'edusyn-edulab-local-v1'
const DATABASE_VERSION = 1
const ATTEMPTS_STORE = 'attempts'
const OUTBOX_STORE = 'outbox'
const ATTEMPT_INDEX = 'by-attempt'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ATTEMPTS_STORE)) {
        database.createObjectStore(ATTEMPTS_STORE, { keyPath: 'definition.definitionId' })
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'eventId' })
        outbox.createIndex(ATTEMPT_INDEX, 'attemptId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open EduLab local storage.'))
  })
}

export async function loadLocalAttempt(definitionId: string): Promise<unknown | undefined> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(ATTEMPTS_STORE, 'readonly')
    return await requestResult(transaction.objectStore(ATTEMPTS_STORE).get(definitionId))
  } finally {
    database.close()
  }
}

export async function persistLocalAttempt(record: LocalAttemptRecord, events: DomainEvent[]): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([ATTEMPTS_STORE, OUTBOX_STORE], 'readwrite')
    transaction.objectStore(ATTEMPTS_STORE).put(record)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    for (const queued of outboxRecords(events)) outbox.put(queued)
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}

export async function listPendingEvents(attemptId: string): Promise<OutboxRecord[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(OUTBOX_STORE, 'readonly')
    const records = await requestResult(transaction.objectStore(OUTBOX_STORE).index(ATTEMPT_INDEX).getAll(attemptId)) as OutboxRecord[]
    return records.sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId))
  } finally {
    database.close()
  }
}

export async function discardLocalAttempt(definitionId: string, attemptId?: string): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([ATTEMPTS_STORE, OUTBOX_STORE], 'readwrite')
    transaction.objectStore(ATTEMPTS_STORE).delete(definitionId)
    if (attemptId) {
      const outbox = transaction.objectStore(OUTBOX_STORE)
      const keys = await requestResult(outbox.index(ATTEMPT_INDEX).getAllKeys(attemptId))
      for (const key of keys) outbox.delete(key)
    }
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}
