import LibraryView from "./FixedViews/Library/LibraryView";
import SettingsView from "./FixedViews/Settings/SettingsView";
import styles from "./Workspace/workspace.module.css";

export default function FixedView({ appMode }) {
    const View = appMode === "library" ? LibraryView : SettingsView;
    return (
        <div className={styles.view_container}>
            <div className={styles.content}><View /></div>
        </div>
    );
}
