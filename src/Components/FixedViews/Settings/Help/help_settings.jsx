import React, { useState } from "react";
import { Keyboard, Scale } from '../../../../assets/IconList';
import { useTranslation } from "react-i18next";
import { SettingsListView, SettingsRow } from "../shared/SettingsListView";
import ShortcutDialog from "./shortcut_dialog";
import LicenseDialog from "./license_dialog";

export default function HelpSettings() {
    const { t } = useTranslation();
    const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
    const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

    return (
        <>
            <SettingsListView title={t("settings.design.resources")}>
                <SettingsRow
                    icon={<Keyboard size={20} />}
                    title={t("settings.shortcuts.title")}
                    description={t("settings.shortcuts.description")}
                    onClick={() => setIsShortcutDialogOpen(true)}
                />

                <SettingsRow
                    icon={<Scale size={20} />}
                    title={t("settings.licenses.title")}
                    description={t("settings.licenses.description")}
                    onClick={() => setIsLicenseDialogOpen(true)}
                />
            </SettingsListView>
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
