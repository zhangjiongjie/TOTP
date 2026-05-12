# TOTP HarmonyOS NEXT Client

这个目录承载 HarmonyOS NEXT 客户端工程，当前阶段先提供 `Empty Ability + Stage` 的最小骨架，后续再逐步接入共享的 `@totp/core` 与 `@totp/sync`。

## 当前结构

- `AppScope/app.json5`：应用全局配置
- `build-profile.json5`：工程级构建配置
- `hvigor-config.json5`：hvigor 工程元信息
- `hvigorfile.ts`：工程级构建任务入口
- `oh-package.json5`：工程级依赖与参数配置
- `entry/`：主 HAP 模块

## 后续接入原则

- 页面层不直接依赖浏览器插件端代码。
- 先通过鸿蒙端 Facade 层接共享逻辑，再逐步替换本地 mock。
- 真机构建前需要补调试签名配置。
