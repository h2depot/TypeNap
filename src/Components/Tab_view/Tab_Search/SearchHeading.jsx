import { useAppSettings } from '../../../store/saving/appSettings';
import { useTNTheme } from '../../TNDesignSystem/theme';
import { searchWordmarks } from '../../../assets/search/wordmarks';
import styles from './tab_search.module.css';

export default function SearchHeading() {
    const selectedEngine = useAppSettings((state) => state.settings.SearchingEngine);
    const theme = useTNTheme();
    const engine = ['Google', 'Bing', 'DuckDuckGo', 'Yahoo'].includes(selectedEngine) ? selectedEngine : 'Google';
    const prefix = searchWordmarks['Search with'];
    const wordmark = searchWordmarks[engine];
    // The engine sits beside "with", below the first line "Search".
    const engineX = 85;
    const engineY = 34;
    const width = engineX + wordmark.width;
    const height = Math.max(prefix.height, engineY + wordmark.height);

    return (
        <h1 className={styles.searchHeading} style={{
            width: `${width * 1.5}px`,
            color: theme === 'dark' ? '#D4CFBF' : '#232B69',
        }}>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Search with ${engine}`}>
                <g fill="currentColor">
                    {prefix.paths.map((d, index) => <path key={index} d={d} />)}
                    <g transform={`translate(${engineX} ${engineY})`}>
                        {wordmark.paths.map((d, index) => <path key={index} d={d} />)}
                    </g>
                </g>
            </svg>
        </h1>
    );
}
