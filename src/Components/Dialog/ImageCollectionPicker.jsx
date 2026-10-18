import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, PageSearch, Plus } from '../../assets/IconList';
import { TN_Button, TN_Dropdown, TN_IconButton, TN_ImageOption, TN_TextField } from '../TNDesignSystem';
import { selectImages } from '../FixedViews/Image/imageGallery';
import styles from './ImageCollectionPicker.module.css';

export default function ImageCollectionPicker({ images, selectedPath, onSelect, onImport, disabled = false, isSelected, isImageDisabled, label, expanded = false, showImport = true, dimSelected = false }) {
    const { t, i18n } = useTranslation();
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [ascending, setAscending] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const operation = useRef(false);
    const visible = useMemo(() => selectImages(images, { query, sortBy, ascending, locale: i18n.language }),
        [images, query, sortBy, ascending, i18n.language]);
    const importImage = async () => {
        if (operation.current || disabled) return;
        operation.current = true;
        setBusy(true);
        setError('');
        try {
            await onImport();
            setQuery('');
        } catch (error) {
            setError(String(error));
        } finally {
            operation.current = false;
            setBusy(false);
        }
    };
    return <section className={expanded ? `${styles.content} ${styles.expanded}` : styles.content} onKeyDown={event => {
        if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
    }} aria-label={label || t('background.chooseImage')} aria-busy={busy}>
        <div className={styles.controls}>
            <div className={styles.search}>
                <TN_TextField value={query} onChange={event => setQuery(event.target.value)}
                    placeholder={t('imageLibrary.searchPlaceholder')} aria-label={t('imageLibrary.searchPlaceholder')}
                    icon={<PageSearch size={18} />} />
            </div>
            <TN_Dropdown value={sortBy} onChange={setSortBy} width="160px" aria-label={t('library.sort.placeholder')}
                options={[
                    { value: 'name', label: t('imageLibrary.sortName') },
                    { value: 'updated', label: t('library.sort.updated') },
                    { value: 'created', label: t('library.sort.created') },
                ]} />
            <TN_IconButton type="button" variant="secondary"
                icon={ascending ? <ArrowUpWideNarrow size={20} /> : <ArrowDownWideNarrow size={20} />}
                onClick={() => setAscending(value => !value)}
                aria-label={t(ascending ? 'library.sort.ascending' : 'library.sort.descending')}
                title={t(ascending ? 'library.sort.ascending' : 'library.sort.descending')} />
        </div>
        <div className={styles.importRow}>
            <span role="status">{t('imageLibrary.resultCount', { count: visible.length, total: images.length })}</span>
            {showImport && <TN_Button type="button" variant="secondary" disabled={busy || disabled} onClick={importImage}>
                <Plus size={18} />{t(busy ? 'imageLibrary.importing' : 'objectImages.import')}
            </TN_Button>}
        </div>
        {error && <p role="alert" className={styles.error}>{t('notice.imageAddFailed')}: {error}</p>}
        <div className={styles.gallery}>
            {visible.map(image => <TN_ImageOption key={image.path} image={image}
                selected={isSelected ? isSelected(image) : selectedPath === image.path} width={120} height={105} showName
                dimmed={dimSelected && (isSelected ? isSelected(image) : selectedPath === image.path)}
                onSelect={onSelect} disabled={busy || disabled || Boolean(isImageDisabled?.(image))} />)}
        </div>
        {!visible.length && <p className={styles.empty}>{t(query.trim() ? 'imageLibrary.noResults' : 'settings.backgroundDialog.noImages')}</p>}
    </section>;
}
