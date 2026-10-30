import { contentsInfo, contentId } from './contentsInfo.js';
import { useFileStore } from './fileStore';
import { useStoryStore } from './storyStore';
import { useTxtStore } from './txtStore';

const pending = new Map();

// Reopening a menu while its operation is pending must not create another copy.
function once(key, task) {
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve().then(task).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
}

export function duplicateContent(value) {
    const info = contentsInfo(value);
    return once(`content:${contentId(info)}`, async () => {
        // saveContent also waits for any earlier save of this workspace.
        await useTxtStore.getState().saveContent(contentId(info));
        const current = useTxtStore.getState().workspaces[contentId(info)]?.contentsInfo ?? info;
        return useFileStore.getState().duplicateContent(current);
    });
}

export function duplicateStory(storyName) {
    return once(`story:${storyName}`, async () => {
        await useStoryStore.getState().saveSynopsis(storyName);
        const workspaces = useTxtStore.getState().workspaces;
        for (const [id, workspace] of Object.entries(workspaces)) {
            if (workspace.story_name === storyName) {
                await useTxtStore.getState().saveContent(id);
            }
        }
        return useFileStore.getState().duplicateStory(storyName);
    });
}
