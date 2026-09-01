import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import ja from '../Constants/Language/ja.json';
import en from '../Constants/Language/en.json';

const initialization = i18next.use(initReactI18next).init({
    resources: {
        ja: { translation: ja },
        en: { translation: en },
    },
    lng: 'ja',
    fallbackLng: 'ja',
    interpolation: {
        escapeValue: false,
    },
});

export const changeLanguage = async (language) => {
    await initialization;
    await i18next.changeLanguage(language);
};

export default i18next;
