export const IMAGE_COLUMNS = 4;
export const IMAGE_GAP = 16;
export const IMAGE_META_HEIGHT = 58;

// Keep the input order in the DOM. Only the visual coordinates follow the columns.
export function layoutImages(images, dimensions, galleryWidth) {
    if (galleryWidth <= 0 || !images.length) return { items: [], height: 0 };

    const width = Math.max(1, (galleryWidth - IMAGE_GAP * (IMAGE_COLUMNS - 1)) / IMAGE_COLUMNS);
    const heights = Array(IMAGE_COLUMNS).fill(0);
    const items = images.map((image, index) => {
        const size = dimensions[image.path];
        const ratio = size?.width > 0 && size?.height > 0 ? size.height / size.width : 1;
        const imageHeight = width * ratio;
        const height = imageHeight + IMAGE_META_HEIGHT;
        // Explicitly place the first four left to right; ties also favor the left.
        const column = index < IMAGE_COLUMNS ? index : heights.indexOf(Math.min(...heights));
        const item = { image, column, x: column * (width + IMAGE_GAP), y: heights[column], width, height, imageHeight };
        heights[column] += height + IMAGE_GAP;
        return item;
    });

    return { items, height: Math.max(...heights) - IMAGE_GAP };
}

export function selectImages(images, { query = '', sortBy = 'name', ascending = true, locale = 'ja' } = {}) {
    const search = query.trim().normalize('NFKC').toLocaleLowerCase(locale);
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    return images.filter(image => image.name.normalize('NFKC').toLocaleLowerCase(locale).includes(search))
        .sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'updated') comparison = (a.last_update ?? 0) - (b.last_update ?? 0);
            if (sortBy === 'created') comparison = (a.created_at ?? 0) - (b.created_at ?? 0);
            comparison ||= collator.compare(a.name, b.name) || a.path.localeCompare(b.path);
            return ascending ? comparison : -comparison;
        });
}
