// One order for image renames and writes that may contain an image reference.
// Read the current draft inside the callback, after an earlier rename finishes.
let tail = Promise.resolve();
let blocked = null;
export function blockImageReferenceWrites(error) { blocked = error; }
export function withImageReferenceWrite(task) {
    const pending = tail.catch(() => undefined).then(() => { if (blocked) throw blocked; return task(); });
    tail = pending.catch(() => undefined);
    return pending;
}
