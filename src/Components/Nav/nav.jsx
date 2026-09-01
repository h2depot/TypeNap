import React, { useState } from "react";
import { House, Library, Settings, X, ChevronDown, ChevronUp } from "lucide-react";
import { useTabStore } from "../../store/tabStore";
import styles from "./nav.module.css";
import { GhostIconButton, GhostTooltip } from "../GhostDesignSystem";
import { AnimatePresence, motion } from "framer-motion";

export default function Nav() {
    const { addTab, closeTab, selectedIndex } = useTabStore();
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <>
            <div
                style={{
                    position: "relative",
                    width: "76px",
                    flexShrink: 0,
                    transform: "translateY(-136px)",
                }}
            >
                {/* Outer container doesn't need gap or layout, it sizes to its children */}
                <div
                    className={styles.container}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        zIndex: 50,
                        gap: 0, // Override CSS gap to prevent snapping
                    }}
                >
                    <GhostTooltip content={isExpanded ? "Collapse" : "Expand"} position="right">
                        <GhostIconButton
                            icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                            onClick={() => setIsExpanded(!isExpanded)}
                            variant="primary"
                            size="large"
                        />
                    </GhostTooltip>

                    <AnimatePresence initial={false}>
                        {isExpanded && (
                            <motion.div
                                key="nav-items"
                                initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                                animate={{ height: "auto", opacity: 1, overflow: "visible" }}
                                exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                                {/* Inner wrapper applies the spacing so it collapses smoothly */}
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "20px",
                                    paddingTop: "20px"
                                }}>
                                    <GhostTooltip content="Home" position="right">
                                        <GhostIconButton
                                            icon={<House />}
                                            onClick={() => addTab("home", "Home")}
                                            variant="secondary"
                                            size="large"
                                        />
                                    </GhostTooltip>

                                    <GhostTooltip content="Library" position="right">
                                        <GhostIconButton
                                            icon={<Library />}
                                            onClick={() => addTab("library", "Library")}
                                            variant="secondary"
                                            size="large"
                                        />
                                    </GhostTooltip>

                                    <GhostTooltip content="Settings" position="right">
                                        <GhostIconButton
                                            icon={<Settings />}
                                            onClick={() => addTab("settings", "Settings")}
                                            variant="secondary"
                                            size="large"
                                        />
                                    </GhostTooltip>

                                    <GhostTooltip content="Close Tab" position="right">
                                        <GhostIconButton
                                            icon={<X />}
                                            onClick={() => closeTab(selectedIndex)}
                                            variant="secondary"
                                            size="large"
                                        />
                                    </GhostTooltip>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
}
