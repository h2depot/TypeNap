export function duplicateName(name, names, maxLength = 200) {
    const normalize = value => value.trim().normalize('NFKC').toLocaleLowerCase();
    const taken = new Set(names.map(normalize));
    for (let number = 1; ; number++) {
        const suffix = ` (${number})`;
        const candidate = `${name.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
        if (!taken.has(normalize(candidate))) return candidate;
    }
}
