import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useImageStore } from "../../../../store/imageStore";
import { normalizeImagePath } from '../../../../utils/imagePaths.js';

export function useBackgroundSettings(initialPath) {
    const addUserImage = useImageStore((state) => state.addUserImage);
    const fetchImageList = useImageStore((state) => state.fetchImageList);
    const wholeImageList = useImageStore((state) => state.wholeImageList);

    const [selectedBgImage, setSelectedBgImage] = useState(initialPath || "");

    const handleAddBackgroundImage = useCallback(async () => {
        const file = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
        });

        if (!file) {
            return;
        }

        const addedImage = await addUserImage(file);
        await fetchImageList();
        setSelectedBgImage(addedImage.path);
    }, [addUserImage, fetchImageList]);


    return { selectedBgImage: normalizeImagePath(selectedBgImage), setSelectedBgImage, wholeImageList, fetchImageList, handleAddBackgroundImage };
}
