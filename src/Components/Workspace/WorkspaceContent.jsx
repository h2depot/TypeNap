import { useTranslation } from "react-i18next";
import { useTabStore } from "../../store/tabStore";
import { TN_Button } from "../TNDesignSystem";
import TypeNapLogo from "../TypeNapLogo/TypeNapLogo";
import { workspaceTabTypes } from "./workspaceTabTypes";
import styles from "./workspace.module.css";

export default function WorkspaceContent({ isActive }) {
    const { t } = useTranslation();
    const { tabsList, selectedIndex, setAppMode, addTab } = useTabStore();
    const activeTab = tabsList[selectedIndex];
    return (
        <div className={styles.content}>
            {tabsList.map((tab) => {
                const definition = workspaceTabTypes[tab.type];
                const selected = tab.id === activeTab?.id;
                if (!selected && !definition?.keepMounted) return null;
                const Content = definition?.component;
                return (
                    <div key={tab.id} style={{ display: selected ? "block" : "none", height: "100%" }}>
                        {Content ? <Content {...tab.props} tabId={tab.id} isActive={isActive && selected} /> : t("tabs.noContent")}
                    </div>
                );
            })}
            {!activeTab && <div className={styles.empty}>
                <div className={styles.workspaceIntro}>
                    <TypeNapLogo className={styles.workspaceLogo} />
                    <h1>{t("navigation.workspace")}</h1>
                    <div className={styles.introActions}>
                        <TN_Button onClick={() => setAppMode("library")}>{t("navigation.chooseStory")}</TN_Button>
                        <TN_Button variant="secondary" onClick={() => addTab("search", "Search")}>{t("navigation.addSearch")}</TN_Button>
                    </div>
                </div>
            </div>}
        </div>
    );
}
