import { useTranslation } from 'react-i18next';
import { useTNTheme } from './theme';
import { getBookCoverStyle } from './bookCoverStyle';
import "./TN_BookCard.css";
import { motion as Motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import TN_Menu from "./TN_Menu";

function TN_BookCard({ title, updated = '2026-05-26', OnClick, OnMoreClick, onClick = OnClick, onMoreClick = OnMoreClick, menuItems, coverColor, textColor, theme: themeOverride }) {
  const theme = useTNTheme(themeOverride);
    const { t } = useTranslation();

    const defaultMenuItems = [
        { label: t('library.actions.details'), onClick: () => console.log('View book:', title) },
        { label: t('library.actions.edit'), onClick: () => console.log('Edit book:', title) },
        { label: t('library.actions.delete'), onClick: () => console.log('Delete book:', title), isDanger: true }
    ];

    const items = menuItems || defaultMenuItems;

    const coverStyle = getBookCoverStyle(coverColor);

    return (
        <div className="TN_book-item" data-tn-theme={theme}>
            <Motion.button
                type="button"
                onClick={onClick}
                className="TN_book-cover-button"
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                variants={{
                    initial: { y: 0, scale: 1, rotateX: 0 },
                    hover: { y: 0, scale: 1, rotateX: 0 },
                    tap: { y: 4, scale: 0.94, rotateX: -8 }
                }}
                transition={{ type: "spring", stiffness: 700, damping: 30, mass: 0.6 }}
            >
                <div className="TN_book-cover" style={coverStyle}>
                    <div className="TN_book-spine" />
                    <div className="TN_book-edge" />
                    {textColor !== 'transparent' && <div className="TN_book-title" style={{ color: textColor || undefined }}>
                        {title}
                    </div>}

                </div>
            </Motion.button>

            <div className="TN_book-meta">
                <div
                    className="TN_book-meta-info"
                    onClick={onClick}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="TN_book-meta-title">{title}</div>
                    <div className="TN_book-meta-sub">{updated}</div>
                </div>
                <TN_Menu
                    theme={theme}
                    placement="bottom"
                    items={items}
                    trigger={
                        <button
                            className="TN_book-meta-more"
                            type="button"
                            onClick={onMoreClick}
                            aria-label="その他の操作"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    }
                />
            </div>
        </div>
    );
}
export default TN_BookCard;
