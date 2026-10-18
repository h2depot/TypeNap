import LibraryView from "./FixedViews/Library/LibraryView";
import SettingsView from "./FixedViews/Settings/SettingsView";
import TemplateView from "./FixedViews/Template/TemplateView";
import ImageView from "./FixedViews/Image/ImageView";
import styles from "./Workspace/workspace.module.css";

export default function FixedView({ appMode }) {
    const View = appMode === "library" ? LibraryView : appMode === "template" ? TemplateView : appMode === "images" ? ImageView : SettingsView;
    return (
        <div className={styles.view_container}>
            <div className={styles.content}><View /></div>
        </div>
    );
}
