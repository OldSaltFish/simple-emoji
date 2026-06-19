# Design System — 魂祈梦前端

> 风格参考：[omp.sh](https://omp.sh/) — 开发者工具的克制美学。
> 核心原则：**内容即视觉，功能即设计。少装饰，多呼吸。**

---

## 1. 设计哲学

| 原则 | 说明 |
|------|------|
| **原生感** | 面向开发者用户，等宽字体、终端美学、代码块作为一等视觉元素 |
| **克制** | 不用 gradient、不用大阴影、不堆砌圆角。一个页面最多一个强调色 |
| **呼吸** | 行高宽松（1.6+），段落间距充足，信息密度低但有效信息高 |
| **稳定** | 布局不抖动。展开/收起、图片加载、状态切换都不应导致页面位移 |
| **暗色优先** | 暗色模式是一等公民，不是事后补丁 |

## 2. 色彩系统

### 中性色（灰度为主）

```
背景层级:
  bg-white      — 主背景 / 卡片 / 输入区
  bg-gray-50    — 次级背景（hover 态、空态区）
  bg-gray-100   — 三级背景（侧栏、禁用态填充）

边框层级:
  border-gray-200 — 默认边框（输入框、卡片）
  border-gray-100 — 分隔线（更轻）

文字层级:
  text-gray-900    — 主标题
  text-gray-700    — 正文
  text-gray-500    — 次要文字（说明、标签）
  text-gray-400    — 占位符、辅助信息
  text-gray-300    — 禁用态文字
```

### 强调色

```
主色: indigo-600 (#4F46E5)
  - 按钮、链接、选中态、用户消息气泡
  - hover: indigo-700
  - 浅底: indigo-50 / indigo-100

语义色:
  成功: emerald-400/500/600     — 可用状态灯、成功提示
  错误: red-400/500/600         — 错误提示、禁用状态灯
  警告: amber-400/500           — 警告（慎用）
```

**规则：一个视觉区域内只用一种强调色。不要混用 indigo + blue + purple。**

## 3. 字体排版

### 字体栈

```css
/* UI 文字（默认） */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 等宽文字（代码、模型名、ID） */
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
```

### 字号阶梯

| 用途 | 大小 | 字重 | 行高 |
|------|------|------|------|
| 页面标题 | text-xl (20px) | font-bold (700) | — |
| 区块标题 | text-base (16px) | font-semibold (600) | tight |
| 正文 | text-sm (14px) | font-normal (400) | relaxed (1.625) |
| 小字/标签 | text-xs (12px) | font-normal (400) | — |
| 微型（来源名等） | text-[10px]-text-[11px] | font-normal | — |

### 规则

- **模型 ID、端点 URL、命令行输出 → 必须用 `font-mono`**
- **正文行高不低于 1.6**，代码块可 1.5
- **标题不使用渐变色或特殊效果**
- **全大写字母仅用于极短的标签**（如 API 格式选择），且字号 ≤ 11px

## 4. 间距与布局

### 间距单位（4px 基准）

```
紧凑: 1 (4px)    — 图标与文字间隙、内联元素
标准: 2 (8px)    — 同组元素间距
舒适: 3 (12px)   — 区块内间距
宽松: 4 (16px)   — 区块间间距
段落: 6 (20px)+  — 独立区块之间
```

### 容器

```
主容器: max-w-3xl (768px)  — 聊天、表单等聚焦区域
宽容器: max-w-[1280px]    — 全局导航
无限制: w-full             — 表格、图片网格
```

### 圆角

```
小: rounded-md (6px)   — 输入框、按钮、标签
中: rounded-lg (8px)   — 卡片、消息气泡
大: rounded-xl (12px)  — 弹窗、模态面板
全圆: rounded-full     — 头像、状态灯
```

**规则：统一使用 md/lg/xl 三档，不要出现 rounded-sm 或自定义像素值。**

## 5. 组件规范

### 按钮

```
/* 主要操作 */
bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 rounded-lg px-4 py-2 text-sm

/* 次要操作 */
bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm

/* 图标按钮 */
w-9 h-9 (或 w-7 h-7 紧凑) rounded-lg flex items-center justify-center
hover:bg-gray-50 text-gray-500 hover:text-indigo-600

/* 禁用 */
opacity-30 cursor-not-allowed (不变色，只降低透明度)
```

### 输入框

```
基础样式:
  border border-gray-200 rounded-lg bg-white
  px-3 py-2 text-sm
  placeholder:text-gray-400
  focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100

Focus 态变化:
  仅边框颜色变 + 微弱 ring 光晕
  不改变外框尺寸、不加阴影
```

### 卡片 / 容器

```
基础卡片:
  bg-white border border-gray-200 rounded-xl shadow-xs (几乎不可见)

Focus/激活态:
  focus-within:border-indigo-400
  focus-within:shadow-sm focus-within:shadow-{color}-100/40
```

### 消息气泡

```
用户消息:
  bg-indigo-600 text-white rounded-xl rounded-br-sm (右下角尖)

AI 消息:
  bg-white text-gray-800 rounded-xl rounded-bl-sm shadow-sm border border-gray-100/60 (左下角尖)

最大宽度: max-w-[85%]
内边距: px-3 py-2
字号: text-[13px]
行高: leading-relaxed
```

### 下拉菜单 / Popover

```
容器:
  bg-white border border-gray-200 rounded-lg shadow-xl
  z-50 (确保在最上层)
  max-h-48 overflow-y-auto (限制高度)

方向:
  优先向上弹出 (bottom-full mb-0.5)，防止溢出屏幕
  仅当空间不足时向下弹出 (top-full mt-0.5)

选项:
  px-2 py-0.5 ~ py-1 text-xs ~ text-[11px]
  hover:bg-{color}-50 transition-colors
  当前选中: bg-{color}-50 text-{color}-600 font-medium
```

## 6. 交互行为

### 过渡动画

```css
/* 标准过渡（用于颜色、边框） */
transition-colors duration-200

/* 完整过渡（用于 transform、opacity） */
transition-all duration-200

/* 入场动画（消息、列表项） */
animate-in fade-in duration-150        /* 淡入 */
animate-in fade-in slide-in-from-*-2  /* 滑入 */

/* 加载指示器 */
animate-pulse  /* 光标闪烁 */
animate-bounce /* 点跳动（loading dots） */
animate-spin   /* 旋转（发送按钮） */
```

### 反馈规则

| 操作 | 反馈 |
|------|------|
| 点击按钮 | active:scale-95 (按压收缩) |
| Hover 可点击元素 | 颜色加深 / bg 变化 |
| Loading 状态 | spinner 替换图标，或光标闪烁 |
| Error 状态 | 红色文字，原位显示，不弹 toast |
| 禁用状态 | opacity-30 + cursor-not-allowed，**不隐藏元素** |

### 布局稳定性

- **所有可折叠区域的收起态必须预留固定高度占位**
- **图片预览区始终显示空态占位框**（虚线），选图后替换而非插入
- **下拉菜单使用 absolute 定位，不影响文档流**
- **避免 animate-in 导致周围元素位移**

## 7. 暗色模式

> TODO: 全面的暗色模式支持。当前以亮色为主。

### 预设映射（待实现）

```
white       → gray-900 / gray-950
gray-50     → gray-800
gray-100    → gray-800 / gray-780
gray-200    → gray-700
border-gray-200 → border-gray-700
text-gray-900 → text-gray-100
text-gray-700 → text-gray-300
text-gray-500 → text-gray-400
text-gray-400 → text-gray-500
shadow-sm   → shadow-none 或微弱发光
```

## 8. 禁止事项

1. **禁止** 使用 gradient 背景（除极简 logo 外）
2. **禁止** 使用 blur > backdrop-blur-sm（毛玻璃仅用于拖拽遮罩）
3. **禁止** 阴影堆叠（shadow-md 以上仅用于模态弹窗）
4. **禁止** 圆角不一致（同层组件必须使用相同圆角档位）
5. **禁止** 展开收起导致页面抖动
6. **禁止** 使用 emoji 作为 UI 元素（图标用 SVG）
7. **禁止** 在非代码场景使用等宽字体做正文
8. **禁止** popup 向下溢出屏幕（优先向上弹出）
9. **禁止** 一个页面使用超过一种强调色系
10. **禁止** 无意义的装饰性动画（loading 除外）

## 9. 技术约束

- **CSS 框架**: UnoCSS (Tailwind v4 兼容)
- **重置**: `@unocss/reset/tailwind-v4.css`
- **框架**: SvelteKit + Svelte 5 Runes
- **响应式**:
  - **公开页面**（表情包、脚本分享、工具集等）: 移动端优先，断点 sm(640) / md(768) / lg(1024) / xl(1280)
  - **管理后台**（/admin、/admin-feat 等）: **仅桌面端**，不适配移动端。固定最小宽度，布局以效率为优先
- **图标**: 内联 SVG（不依赖图标库）
