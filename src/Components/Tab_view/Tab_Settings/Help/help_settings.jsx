import React, { useState } from "react";
import { Keyboard, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SpiritListItem, SpiritListView } from "../../../GhostDesignSystem";
import ShortcutDialog from "./shortcut_dialog";
import LicenseDialog from "./license_dialog";
import styles from "../tab_settings.module.css";

export default function HelpSettings() {
    const { t } = useTranslation();
    const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
    const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

    return (
        <>
            <SpiritListView maxWidth="100%" className={styles.settingsList}>
                <SpiritListItem
                    icon={<Keyboard size={20} />}
                    title={t("settings.shortcuts.title")}
                    description={t("settings.shortcuts.description")}
                    onClick={() => setIsShortcutDialogOpen(true)}
                />

                <SpiritListItem
                    icon={<Scale size={20} />}
                    title={t("settings.licenses.title")}
                    description={t("settings.licenses.description")}
                    onClick={() => setIsLicenseDialogOpen(true)}
                />
            </SpiritListView>
            <ShortcutDialog
                isOpen={isShortcutDialogOpen}
                onClose={() => setIsShortcutDialogOpen(false)}
            />
            <LicenseDialog
                isOpen={isLicenseDialogOpen}
                onClose={() => setIsLicenseDialogOpen(false)}
            />
        </>
    );
}
