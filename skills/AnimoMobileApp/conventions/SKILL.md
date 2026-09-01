# AnimoMobileApp conventions

Conventions for the AnimoMobileApp React Native app.

## Rules

- Keep navigation config centralized; screens stay presentational.
- Never block the JS thread; move heavy work off the render path.
- Use platform-aware components; test on both iOS and Android.
- Keep native module usage behind a typed wrapper.
