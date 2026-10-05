import React, { useRef, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useContextMenuStore } from "../../store/contextMenuStore";
import TabLauncher from "../Workspace/TabLauncher";
import { RightArrow } from "../../assets/IconList";

const NomalContextMenu = () => {
    const { isOpen, x, y, options, closeMenu } = useContextMenuStore();
    const menuRef = useRef(null);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const [isMeasured, setIsMeasured] = useState(false);
    const [submenuAnchor, setSubmenuAnchor] = useState(null);

    useLayoutEffect(() => {
        if (!isOpen) {
            setIsMeasured(false);
            setSubmenuAnchor(null);
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
                    onMouseLeave={() => setSubmenuAnchor(null)}
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
                            backgroundColor: "var(--tn-dialog-bg)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid #D4CFBF",
                            borderRadius: "14px",
                            boxShadow: "var(--tn-shadow-large)",
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
                                            background: "var(--tn-border-light)",
                                            margin: "4px 8px",
                                        }}
                                    />
                                );
                            }

                            return (
                                <motion.button
                                    key={`item-${idx}`}
                                    disabled={item.disabled}
                                    aria-haspopup={item.submenu ? "dialog" : undefined}
                                    aria-expanded={item.submenu ? Boolean(submenuAnchor) : undefined}
                                    onMouseEnter={(e) => setSubmenuAnchor(item.submenu && !item.disabled ? e.currentTarget : null)}
                                    onFocus={(e) => setSubmenuAnchor(item.submenu && !item.disabled ? e.currentTarget : null)}
                                    onKeyDown={(e) => {
                                        if (item.submenu && e.key === "ArrowRight") {
                                            e.preventDefault();
                                            setSubmenuAnchor(e.currentTarget);
                                            document.querySelector('#tab-launcher input')?.focus();
                                        }
                                    }}
                                    whileHover={!item.disabled ? { backgroundColor: "var(--tn-hover-bg)" } : {}}
                                    whileTap={!item.disabled ? { scale: 0.98 } : {}}
                                    onClick={(e) => item.submenu ? setSubmenuAnchor(e.currentTarget) : handleItemClick(e, item.onClick)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-start",
                                        width: "100%",
                                        padding: "8px 12px",
                                        border: "none",
                                        background: "transparent",
                                        color: item.isDanger ? "#ef4444" : "var(--tn-text)",
                                        fontSize: "13px",
                                        fontWeight: 'var(--font-weight-ui)',
                                        borderRadius: "8px",
                                        cursor: item.disabled ? "not-allowed" : "pointer",
                                        opacity: item.disabled ? 0.45 : 1,
                                        textAlign: "left",
                                        transition: "color 0.2s, opacity 0.2s",
                                    }}
                                >
                                    {item.label}
                                    {item.submenu && <RightArrow size={16} style={{ marginLeft: "auto" }} aria-hidden="true" />}
                                </motion.button>
                            );
                        })}
                    </motion.div>
                    {submenuAnchor && <TabLauncher contextAnchor={submenuAnchor} onDismiss={closeMenu} />}
                </div>
            )}
        </AnimatePresence>
    );
};

export default NomalContextMenu;
