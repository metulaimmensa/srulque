# Srulque

Неоновая аркада про взлом замка. Жми, когда стрелка внутри сектора.

**Играть:** https://metulaimmensa.github.io/srulque/

Created by Mentula Immensa · Music and sounds: Traumträumer

## Структура

| Путь | Что это |
|---|---|
| `docs/` | Игра целиком (HTML, звуки, шрифты, иконки). Отсюда же раздаётся GitHub Pages. |
| `android/` | Android-приложение (Capacitor), оборачивает `docs/`. |
| `art/` | Исходники логотипов. |

## Сборка APK

```
npm install
npx cap sync android
cd android && ./gradlew assembleRelease
```

Для подписи нужны `android/keystore.properties` и `srulque-release.jks`. Их **нет в репозитории** и не должно быть: ключ хранится у владельца отдельно.
