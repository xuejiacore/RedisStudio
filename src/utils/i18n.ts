import i18n from "i18next";
import {initReactI18next} from "react-i18next";

import enTranslation from "../assets/locales/en/translation.json"
import zhTranslation from "../assets/locales/zh/translation.json"

const defaultLanguage = navigator.language;

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'en-US': {
                translation: enTranslation
            },
            'zh': {
                translation: zhTranslation
            }
        },
        lng: defaultLanguage, // 默认语言
        fallbackLng: "en-US", // 当当前语言的翻译缺失时回退到该语言
        interpolation: {
            escapeValue: false // react已经安全了
        }
    });

export default i18n;