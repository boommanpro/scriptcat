## 角色

你是一位经验丰富的前端开发工程师和Chrome扩展开发专家，需要为ScriptCat开源项目设计AI对话功能的实现方案。请仔细阅读以下项目信息，并按照要求完成方案设计。

## 项目描述

当前scriptcat是开源项目，是一个chrome扩展程序，用于在chrome浏览器中运行脚本，我需要在当前代码中增加AI对话功能，实现用户和模型之间的对话，自动编写脚本，针对代码块进行测试，运行，保存的功能，提升用户编写脚本的效率。

## 目标描述

1. 为当前项目增加ai对话的，目标是通过ai对话可以编写脚本，在当前网站测试运行，最终保存。
2. 是在当前网站的中嵌入一个ai 对话侧边栏，可以选择引用元素，然后发送相关数据给大模型，技术使用Chrome SidePanel API
    -我期望的是在当前网站，比如我在google.com，然后在当前google.com的右侧侧边栏就出现内容，然后交互选择元素。
    -然后ai模型会返回结果，然后根据结果，生成代码，然后嵌入到当前页面中，然后用户可以运行和保存。
    -然后用户可以运行和保存。
## 注意

1. 使用streamdown处理markdown的数据返回。
2. 如果llm返回的结果包含了javascript，期望他把渲染成代码块，并且具备运行和保存能力。
3. ai对话期望和域名维度去绑定，一个域名一个ai对话，具备持久化能力（避免出现刷新后代码丢失，对话丢失的情况）。
4. 入口在 IconSettings 左边添加 AI 对话图标，点击打开 AI 对话页面（新标签页），传递当前域名作为参数
5. 注意部分能力可能是在浏览器中运行，需要考虑权限问题，所以可能使用的不是传统的web接口，而是浏览器插件的接口调用。

## 补充信息

llm调用代码，注意期望是流式调用，页面流式返回

```curl
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3-4b-2507",
    "messages": [
        {
            "role": "system",
            "content": "Always answer in rhymes. Today is Thursday"
        },
        {
            "role": "user",
            "content": "What day is it today?"
        }
    ],
    "temperature": 0.7,
    "max_tokens": -1,
    "stream": false
}'
```

## 侧边栏技术方案
User点击插件Icon
    ↓
chrome.sidePanel.open()
    ↓
注入Content Script（遮罩层+事件监听）
    ↓
User点击页面元素(AI自动记录特征) → 可多选
    ↓
点击"完成选择" → 生成JSON描述发送到Side Panel
    ↓
用户输入Prompt（如"把选中的按钮变红色"）
    ↓
调用LLM API传入：DOM描述 + Prompt
    ↓
接收AI返回的JS代码 → 在Content Script中沙箱执行
    ↓
实时反馈修改效果到页面

1. Side Panel ↔ Background Service Worker ↔ Content Script
2. 使用 "permissions": ["sidePanel", "scripting", "activeTab", "storage"]
3. 选择器使用css-selector-generator技术方案

## 技术选型
| 组件          | 选型                          | 理由                         |
| ----------- | --------------------------- | -------------------------- |
| 侧边栏技术       | Chrome SidePanel API        | 原生支持，沉浸式体验，自动管理生命周期        |
| 选择器生成       | `css-selector-generator`    | 生成短、稳定、可读的选择器，支持多种策略       |
| Markdown 渲染 | StreamDown                  | 轻量级，支持流式渲染，适配 AI 逐字返回场景    |
| 代码高亮        | PrismJS / Shiki             | 支持 JavaScript 语法高亮，可扩展运行按钮 |
| 存储方案        | IndexedDB (via localforage) | 大容量、异步、支持结构化数据             |
