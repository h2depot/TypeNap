import { useTNTheme } from './theme';
import { getBookCoverStyle } from './bookCoverStyle';
import TN_Tooltip from './TN_Tooltip';
import "./TN_BookCard.css";

function TN_BookCardPreview({ title, coverColor, textColor, tooltip, OnClick, onClick = OnClick, theme: themeOverride, compact = false, showTitle = false }) {
  const theme = useTNTheme(themeOverride);
    const coverStyle = getBookCoverStyle(coverColor);

    return (
        <div className={`TN_book-item${compact ? ' TN_book-preview-compact' : ''}${showTitle ? ' TN_book-preview-with-title' : ''}`} data-tn-theme={theme}>
            <TN_Tooltip content={tooltip} position="bottom" delay={3.5} subtle theme={theme}>
            <button type="button" className="TN_book-cover-button" onClick={onClick} aria-label={tooltip ? `${title}: ${tooltip}` : title}>
                <div className="TN_book-cover" style={coverStyle}>
                    <div className="TN_book-spine" />
                    <div className="TN_book-edge" />
                    {textColor !== 'transparent' && <div className="TN_book-title" style={{ color: textColor || undefined }}>
                        {title}
                    </div>}
                </div>
                {showTitle && <span className="TN_book-preview-title">{title}</span>}
            </button>
            </TN_Tooltip>
        </div>
    );
}

export default TN_BookCardPreview;
