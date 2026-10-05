import WorkspaceContent from "./WorkspaceContent";
import styles from "./workspace.module.css";

export default function Workspace({ isActive }) {
    // Keep the workspace mounted across modes, including native Search webviews.
    return (
        <div className={styles.view_container} style={{ display: isActive ? "flex" : "none" }}>
            <WorkspaceContent isActive={isActive} />
        </div>
    );
}
