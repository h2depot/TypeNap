import React from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import "./GhostBookCard.css";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import GhostMenu from "./GhostMenu";

function GhostBookCard({ key, title, updated = '2026-05-26', OnClick, OnMoreClick, menuItems, coverColor }) {
    const { t } = useTranslation();

    /* gradient color for light/dark theme */
    const gradient = 'var(--ghost-gradient)';

    const defaultMenuItems = [
        { label: t('library.actions.details'), onClick: () => console.log('View book:', title) },
        { label: t('library.actions.edit'), onClick: () => console.log('Edit book:', title) },
        { label: t('library.actions.delete'), onClick: () => console.log('Delete book:', title), isDanger: true }
    ];

    const items = menuItems || defaultMenuItems;

    const isImage = coverColor && !coverColor.startsWith("#") && !coverColor.startsWith("var(");
    const coverStyle = isImage 
        ? { backgroundImage: `url(${convertFileSrc(coverColor)})`, backgroundSize: "cover", backgroundPosition: "center" } 
        : (coverColor ? { backgroundColor: coverColor } : {});

    return (
        <div className="ghost-book-item">
            <motion.button
                onClick={OnClick}
                className="ghost-book-cover-button"
                initial="initial"
                whileHover="hover"
                whileTap="tap"
                variants={{
                    initial: { y: 0, scale: 1, rotateX: 0 },
                    hover: { y: -6, scale: 1.02, rotateX: 2 },
                    tap: { y: 4, scale: 0.94, rotateX: -8 }
                }}
                transition={{ type: "spring", stiffness: 700, damping: 30, mass: 0.6 }}
            >
                <div className="ghost-book-cover" style={coverStyle}>
                    <div className="ghost-book-spine" />
                    <div className="ghost-book-edge" />
                    <div className="ghost-book-title">
                        {title}
                    </div>

                    <motion.div
                        className="ghost-book-border-glow"
                        variants={{
                            initial: { opacity: 0 },
                            hover: { opacity: 1 }
                        }}
                        transition={{ duration: 0.3 }}
                        style={{ background: gradient }}
                    />
                </div>
            </motion.button>

            <div className="ghost-book-meta">
                <div
                    className="ghost-book-meta-info"
                    onClick={OnClick}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="ghost-book-meta-title">{title}</div>
                    <div className="ghost-book-meta-sub">{updated}</div>
                </div>
                <GhostMenu
                    items={items}
                    trigger={
                        <button
                            className="ghost-book-meta-more"
                            onClick={OnMoreClick}
                            aria-label="More options"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    }
                />
            </div>
        </div>
    );
}
export default GhostBookCard;
