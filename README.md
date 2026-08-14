# 元素变换 · Element Transform

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Element Transform">
</p>

<p align="center">
  选中任意页面元素，进行旋转、翻转与缩放。<br>
  对视频同样有效，全屏后变换仍然保持。
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4">
  <img alt="Chrome" src="https://img.shields.io/badge/Chrome-Extension-green">
  <img alt="No build" src="https://img.shields.io/badge/build-none-lightgrey">
</p>

Chrome / Edge 浏览器扩展。无构建步骤、无依赖，克隆后即可加载。

## 功能

- **任意元素**：图片、视频、普通 DOM 节点都可以选中
- **旋转**：±15° / ±90° 快捷按钮，或输入精确角度
- **翻转**：水平 / 垂直翻转；也可指定翻转轴（0° 上下镜像，90° 左右镜像）后再按轴翻转
- **缩放**：步进按钮或输入倍率（如 `1.5`），范围 `0.05`–`10`
- **视频全屏**：对 `<video>` 的变换在全屏后尽量保持
- **选中优先视频**：点击位置下有视频时，优先选中 `video` 而不是覆盖层

## 安装

尚未上架 Chrome 网上应用店，请以开发者模式加载：

1. 打开 Chrome（或 Edge），访问 `chrome://extensions/`（Edge 为 `edge://extensions/`）
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本仓库目录 `element-transform`

加载成功后，工具栏会出现扩展图标。

## 使用

1. 点击工具栏图标，或按 `Alt+Shift+R`，进入选中模式
2. 点击页面上的目标元素（鼠标悬停时会有高亮）
3. 在浮出面板中调整变换：

   | 操作 | 说明 |
   | --- | --- |
   | 旋转 | ±15° / ±90°，或直接输入角度 |
   | 翻转 | 「水平」「垂直」；也可设翻转轴后点「按轴翻转」 |
   | 缩放 | `−` / `+`，或输入倍率 |

4. **重选**：换一个元素；**父级**：选中外层容器
5. **重置变换**：清除当前元素上的旋转 / 翻转 / 缩放
6. `Esc` 取消选中模式；拖动面板标题栏可移动面板

关闭面板不会撤销已经应用的变换。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 点击工具栏图标后，向当前标签页发送「进入选中模式」 |
| `scripting` | 在当前页的所有 iframe 中触发选中 |
| `<all_urls>` | 在任意网站注入内容脚本，才能选中该页元素 |

本扩展 **不收集、不上报、不存储** 浏览数据。变换只作用于当前页面的 DOM 样式，刷新页面后恢复。

## 项目结构

```
element-transform/
├── manifest.json      # Manifest V3 配置
├── background.js      # 工具栏点击 → 通知各 frame 进入选中模式
├── content.js         # 选中、浮层面板、CSS transform、全屏同步
├── icons/             # 16 / 48 / 128 图标
├── LICENSE            # MIT
└── README.md
```

纯 JavaScript，没有打包器、没有 npm 依赖。改完 `content.js` / `background.js` / `manifest.json` 后，到扩展管理页点「重新加载」即可。

## 已知限制

- 部分站点会在全屏时重建 `<video>` 节点，变换可能丢失，需要再选一次
- 个别播放器使用非标准全屏实现，CSS `transform` 不一定能作用到全屏层
- 无法在 `chrome://`、Chrome 网上应用店等受限页面上运行

## 许可

[MIT](LICENSE) © Ggssiwei
