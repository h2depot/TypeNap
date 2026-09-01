import React, { useRef, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContextMenuStore } from "../../store/contextMenuStore";

const NomalContextMenu = () => {
    const { isOpen, x, y, options, closeMenu } = useContextMenuStore();
    const menuRef = useRef(null);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const [isMeasured, setIsMeasured] = useState(false);

    useLayoutEffect(() => {
        if (!isOpen) {
            setIsMeasured(false);
            return;
        }

        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;

            let adjustedX = x;
            let adjustedY = y;

            // Collision detection with screen edges
            if (x + rect.width > winWidth) {
                adjustedX = winWidth - rect.width - 12;
            }
            if (y + rect.height > winHeight) {
                adjustedY = winHeight - rect.height - 12;
            }

            // Ensure coordinates are not negative
            adjustedX = Math.max(12, adjustedX);
            adjustedY = Math.max(12, adjustedY);

            setCoords({ x: adjustedX, y: adjustedY });
            setIsMeasured(true);
        }
    }, [isOpen, x, y, options]);

    const handleItemClick = (e, onClick) => {
        e.stopPropagation();
        if (onClick) onClick();
        closeMenu();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    ref={menuRef}
                    id="nomal-context-menu"
                    style={{
                        position: "fixed",
                        left: isMeasured ? coords.x : x,
                        top: isMeasured ? coords.y : y,
                        opacity: isMeasured ? 1 : 0,
                        zIndex: 99999,
                        pointerEvents: isMeasured ? "auto" : "none",
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                        transition={{ type: "spring", stiffness: 450, damping: 28 }}
                        style={{
                            minWidth: "180px",
                            backgroundColor: "var(--ghost-bg)",
                            backdropFilter: "blur(12px)",
                            border: "2px solid var(--ghost-border)",
                            borderRadius: "14px",
                            boxShadow: "var(--ghost-shadow-large)",
                            padding: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            userSelect: "none",
                            WebkitUserSelect: "none",
                        }}
                    >
                        {options.map((item, idx) => {
                            if (item.isSeparator) {
                                return (
                                    <div
                                        key={`sep-${idx}`}
                                        style={{
                                            height: "1px",
                                            background: "var(--ghost-border-light)",
                                            margin: "4px 8px",
                                        }}
                                    />
                                );
                            }

                            return (
                                <motion.button
                                    key={`item-${idx}`}
                                    disabled={item.disabled}
                                    whileHover={!item.disabled ? { x: 4, backgroundColor: "var(--ghost-hover-bg)" } : {}}
                                    whileTap={!item.disabled ? { scale: 0.98 } : {}}
                                    onClick={(e) => handleItemClick(e, item.onClick)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-start",
                                        width: "100%",
                                        padding: "8px 12px",
                                        border: "none",
                                        background: "transparent",
                                        color: item.isDanger ? "#ef4444" : "var(--ghost-text)",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        borderRadius: "8px",
                                        cursor: item.disabled ? "not-allowed" : "pointer",
                                        opacity: item.disabled ? 0.45 : 1,
                                        textAlign: "left",
                                        transition: "color 0.2s, opacity 0.2s",
                                    }}
                                >
                                    {item.label}
                                </motion.button>
                            );
                        })}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NomalContextMenu;
