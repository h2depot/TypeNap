export function createSuggestionLoader(fetchSuggestions, delay = 250) {
    let timer;
    let generation = 0;
    const cancel = () => {
        generation++;
        clearTimeout(timer);
    };
    return {
        cancel,
        load(query, onResult) {
            cancel();
            if (!query.trim()) { onResult([]); return; }
            const request = generation;
            timer = setTimeout(async () => {
                let suggestions = [];
                try {
                    const result = await fetchSuggestions(query);
                    suggestions = result.suggestions || [];
                } catch { /* Search itself stays usable when suggestions are unavailable. */ }
                if (request === generation) onResult(suggestions);
            }, delay);
        },
    };
}
