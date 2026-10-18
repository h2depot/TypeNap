import { useTranslation } from 'react-i18next';
import styles from './BackupPreview.module.css';

function Value({ value }) {
    if (Array.isArray(value)) return value.length
        ? <ul className={styles.list}>{value.map((item, index) => <li key={index}><Value value={item} /></li>)}</ul>
        : <span className={styles.empty}>—</span>;
    if (value !== null && typeof value === 'object') return <dl className={styles.fields}>
        {Object.entries(value).map(([name, item]) => <div className={styles.field} key={name}>
            <dt>{name}</dt><dd><Value value={item} /></dd>
        </div>)}
    </dl>;
    return <span className={value === '' || value === null ? styles.empty : undefined}>
        {value === '' || value === null ? '—' : String(value)}
    </span>;
}

export default function BackupPreview({ content, title }) {
    const { t } = useTranslation();
    let data;
    try { data = JSON.parse(content); } catch {
        return <p role="status">{t('story.restore.previewUnavailable')}</p>;
    }
    const isPage = data !== null && typeof data === 'object' && !Array.isArray(data);
    const { summary, imagePaths, properties, ...otherFields } = isPage ? data : {};
    const images = (Array.isArray(imagePaths) ? imagePaths : typeof imagePaths === 'string' ? [imagePaths] : [])
        .filter(path => typeof path === 'string' && path.trim());
    return <article className={styles.document}>
        <h2 className={styles.title}>{title}</h2>
        {isPage ? <>
            {summary !== undefined && <section className={styles.section}>
                <h3>{t('story.restore.previewSummary')}</h3><Value value={summary} />
            </section>}
            <section className={styles.section}>
                <h3>{t('story.restore.previewProperties')}</h3>
                {properties !== undefined && <Value value={properties} />}
                {Object.keys(otherFields).length > 0 && <Value value={otherFields} />}
                {properties === undefined && Object.keys(otherFields).length === 0 && <span className={styles.empty}>—</span>}
            </section>
            <section className={styles.section}>
                <h3>{t('story.restore.previewImages')}</h3>
                <Value value={images.map(path => path.split(/[\\/]/).pop())} />
            </section>
        </> : <Value value={data} />}
    </article>;
}
