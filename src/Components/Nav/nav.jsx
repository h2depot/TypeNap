import React from "react";
import { House, Library, Search, Settings, X } from "lucide-react";
import { useTabStore } from "../../store/tabStore";
import styles from "./nav.module.css";
import { GhostIconButton, GhostTooltip } from "../GhostDesignSystem";

export default function Nav() {
    const { addTab, closeTab, selectedIndex, tabsList } = useTabStore();
    const activeType = tabsList[selectedIndex]?.type;

    return (
        <nav className={styles.container} aria-label="Main navigation">
            <div className={styles.group}>
                <GhostTooltip content="Home" position="right">
                    <GhostIconButton
                        icon={<House />}
                        onClick={() => addTab("home", "Home")}
                        variant={activeType === "home" ? "primary" : "ghost"}
                        size="large"
                        borderRadius="14px"
                        aria-label="Home"
                        aria-current={activeType === "home" ? "page" : undefined}
                    />
                </GhostTooltip>
                <GhostTooltip content="Library" position="right">
                    <GhostIconButton
                        icon={<Library />}
                        onClick={() => addTab("library", "Library")}
                        variant={activeType === "library" ? "primary" : "ghost"}
                        size="large"
                        borderRadius="14px"
                        aria-label="Library"
                        aria-current={activeType === "library" ? "page" : undefined}
                    />
                </GhostTooltip>
                <GhostTooltip content="Search" position="right">
                    <GhostIconButton
                        icon={<Search />}
                        onClick={() => addTab("search", "Search")}
                        variant={activeType === "search" ? "primary" : "ghost"}
                        size="large"
                        borderRadius="14px"
                        aria-label="Search"
                        aria-current={activeType === "search" ? "page" : undefined}
                    />
                </GhostTooltip>
            </div>

            <div className={styles.group}>
                <GhostTooltip content="Settings" position="right">
                    <GhostIconButton
                        icon={<Settings />}
                        onClick={() => addTab("settings", "Settings")}
                        variant={activeType === "settings" ? "primary" : "ghost"}
                        size="large"
                        borderRadius="14px"
                        aria-label="Settings"
                        aria-current={activeType === "settings" ? "page" : undefined}
                    />
                </GhostTooltip>
                <GhostTooltip content="Close Tab" position="right">
                    <GhostIconButton
                        icon={<X />}
                        onClick={() => closeTab(selectedIndex)}
                        variant="ghost"
                        size="large"
                        borderRadius="14px"
                        aria-label="Close Tab"
                    />
                </GhostTooltip>
            </div>
        </nav>
    );
}
