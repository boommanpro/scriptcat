interface KnowledgeBaseItem {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    relevance: number;
}

const SCRIPTCAT_KNOWLEDGE_BASE: KnowledgeBaseItem[] = [
    {
        id: "gm_api",
        title: "GM API 介绍",
        category: "API",
        tags: ["GM_api", "API", "函数"],
        relevance: 10,
        content: `ScriptCat 提供了丰富的 GM API，包括：
- GM_xmlhttpRequest: 发起网络请求
- GM_addStyle: 添加CSS样式
- GM_setValue/GM_getValue: 存储和读取数据
- GM_notification: 显示通知
- GM_openInTab: 在新标签页打开URL
- GM_registerMenuCommand: 注册右键菜单
- GM_info: 获取脚本信息
- unsafeWindow: 访问页面的window对象`,
    },
    {
        id: "metadata",
        title: "脚本元数据",
        category: "元数据",
        tags: ["metadata", "元数据", "@name", "@match"],
        relevance: 9,
        content: `ScriptCat 脚本使用 UserScript 标准元数据：
- @name: 脚本名称
- @namespace: 命名空间
- @version: 版本号
- @description: 描述
- @author: 作者
- @match: 匹配URL模式
- @include: 包含URL模式
- @exclude: 排除URL模式
- @grant: 请求权限
- @require: 依赖库
- @resource: 资源文件
- @connect: 连接权限
- @run-at: 运行时机`,
    },
    {
        id: "permissions",
        title: "权限系统",
        category: "权限",
        tags: ["permission", "权限", "@grant"],
        relevance: 8,
        content: `ScriptCat 支持多种权限：
- GM_xmlhttpRequest: 网络请求权限
- GM_addStyle: 添加样式权限
- GM_setValue/GM_getValue: 存储权限
- GM_notification: 通知权限
- GM_openInTab: 打开标签页权限
- GM_registerMenuCommand: 菜单权限
- GM_download: 下载权限
- GM_clipboard: 剪贴板权限
- GM_cookie: Cookie权限
- GM_webRequest: WebRequest权限
- GM_tabs: 标签页权限
- GM_history: 历史记录权限
- GM_bookmark: 书签权限`,
    },
    {
        id: "storage",
        title: "数据存储",
        category: "存储",
        tags: ["storage", "存储", "GM_setValue", "GM_getValue"],
        relevance: 9,
        content: `ScriptCat 提供两种存储方式：
1. GM_setValue/GM_getValue: 跨域存储，数据存储在扩展的存储中
2. localStorage: 同域存储，数据存储在当前域名的localStorage中

GM_setValue/GM_getValue 使用示例：
GM_setValue('key', 'value');
const value = GM_getValue('key');

支持的数据类型：字符串、数字、布尔值、对象、数组`,
    },
    {
        id: "xhr",
        title: "网络请求",
        category: "网络",
        tags: ["xhr", "网络", "GM_xmlhttpRequest"],
        relevance: 9,
        content: `GM_xmlhttpRequest 用于发起网络请求：
GM_xmlhttpRequest({
  method: 'GET',
  url: 'https://example.com/api',
  headers: {
    'Content-Type': 'application/json'
  },
  data: JSON.stringify({ key: 'value' }),
  onload: function(response) {
    console.log(response.responseText);
  },
  onerror: function(error) {
    console.error('请求失败', error);
  }
});

支持的方法：GET, POST, PUT, DELETE, PATCH, HEAD
支持的事件：onload, onerror, onreadystatechange, ontimeout, onprogress`,
    },
    {
        id: "menu",
        title: "右键菜单",
        category: "菜单",
        tags: ["menu", "菜单", "GM_registerMenuCommand"],
        relevance: 7,
        content: `GM_registerMenuCommand 用于注册右键菜单：
GM_registerMenuCommand({
  name: '菜单项名称',
  accessKey: 's',
  onclick: function(info, tab) {
    console.log('菜单被点击', info, tab);
  }
});

参数说明：
- name: 菜单项名称
- accessKey: 快捷键（可选）
- onclick: 点击回调函数
- icon: 图标URL（可选）
- title: 提示文本（可选）

info 对象包含：
- menuItemId: 菜单项ID
- selectionText: 选中的文本`,
    },
    {
        id: "notification",
        title: "通知功能",
        category: "通知",
        tags: ["notification", "通知", "GM_notification"],
        relevance: 7,
        content: `GM_notification 用于显示桌面通知：
GM_notification({
  title: '通知标题',
  text: '通知内容',
  image: '图标URL',
  onclick: function() {
    console.log('通知被点击');
  },
  ondone: function() {
    console.log('通知已关闭');
  }
});

参数说明：
- title: 通知标题（必需）
- text: 通知内容（必需）
- image: 图标URL（可选）
- onclick: 点击回调（可选）
- ondone: 关闭回调（可选）`,
    },
    {
        id: "styling",
        title: "样式注入",
        category: "样式",
        tags: ["style", "样式", "GM_addStyle"],
        relevance: 8,
        content: `GM_addStyle 用于向页面注入CSS样式：
GM_addStyle(\`
  .my-class {
    color: red;
    font-size: 16px;
  }
\`);

也可以动态修改样式：
const styleId = GM_addStyle('.element { color: blue; }');
// 后续可以移除样式
// GM_removeStyle(styleId); // 如果支持的话

样式会立即应用到页面，无需等待DOM加载完成`,
    },
    {
        id: "unsafeWindow",
        title: "unsafeWindow",
        category: "高级",
        tags: ["unsafeWindow", "window", "页面"],
        relevance: 6,
        content: `unsafeWindow 是页面的 window 对象的引用：
const pageWindow = unsafeWindow;
pageWindow.somePageFunction();

注意事项：
1. unsafeWindow 可以访问页面定义的所有全局变量和函数
2. 使用 unsafeWindow 可能会破坏脚本的沙箱隔离
3. 尽量优先使用 GM API 而不是直接操作页面对象
4. 如果需要调用页面函数，使用 unsafeWindow 是最直接的方式

示例：
const originalFunction = unsafeWindow.someFunction;
unsafeWindow.someFunction = function() {
  console.log('函数被拦截');
  return originalFunction.apply(this, arguments);
};`,
    },
    {
        id: "script_lifecycle",
        title: "脚本生命周期",
        category: "生命周期",
        tags: ["lifecycle", "生命周期", "@run-at"],
        relevance: 8,
        content: `ScriptCat 脚本的生命周期：
1. 安装：首次安装脚本时触发
2. 更新：脚本版本更新时触发
3. 启用：脚本被启用时触发
4. 运行：脚本在匹配的页面上运行
5. 禁用：脚本被禁用时触发
6. 卸载：脚本被卸载时触发

运行时机（@run-at）：
- document-start: 在DOM创建之前运行
- document-body: 在body标签创建后运行
- document-end: 在DOM加载完成后运行
- document-idle: 在页面空闲时运行
- context-menu: 在右键菜单打开时运行

默认运行时机：document-end`,
    },
    {
        id: "match_patterns",
        title: "URL匹配模式",
        category: "匹配",
        tags: ["match", "URL", "@match"],
        relevance: 8,
        content: `URL匹配模式语法：
- *: 匹配任意字符
- ?: 匹配单个字符
- [a-z]: 匹配字符范围
- (a|b): 匹配多个选项

示例：
- @match *://*.example.com/*
- @match https://example.com/*
- @match *://example.com/path/*
- @match https://*.google.com/*
- @match http://example.com/*?*

特殊匹配：
- @match *://*/*: 匹配所有URL
- @match file:///*: 匹配本地文件
- @match http://127.0.0.1/*: 匹配本地服务器`,
    },
    {
        id: "debugging",
        title: "调试技巧",
        category: "调试",
        tags: ["debug", "调试", "console"],
        relevance: 7,
        content: `ScriptCat 脚本调试技巧：
1. 使用 console.log 输出调试信息
2. 使用 console.error 输出错误信息
3. 使用 debugger 语句设置断点
4. 使用浏览器开发者工具查看网络请求
5. 查看脚本管理器的日志面板

调试步骤：
1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 刷新页面触发脚本运行
4. 查看控制台输出的日志和错误
5. 使用 Sources 标签设置断点调试

常见问题：
- 脚本没有运行：检查 @match 是否正确
- API 不可用：检查 @grant 是否添加
- 权限被拒绝：检查扩展权限设置`,
    },
    {
        id: "best_practices",
        title: "最佳实践",
        category: "最佳实践",
        tags: ["best", "practice", "最佳实践"],
        relevance: 6,
        content: `ScriptCat 脚本开发最佳实践：
1. 使用严格模式：'use strict';
2. 避免全局变量污染：使用 IIFE 或模块
3. 错误处理：使用 try-catch 包裹关键代码
4. 性能优化：避免频繁的 DOM 操作
5. 代码组织：将功能拆分为独立的函数
6. 注释说明：添加清晰的代码注释
7. 版本管理：使用 @version 标注版本
8. 测试兼容性：在不同浏览器上测试

示例结构：
(function() {
  'use strict';
  
  function main() {
    try {
      // 主逻辑
    } catch (error) {
      console.error('脚本错误:', error);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();`,
    },
    {
        id: "dom_manipulation",
        title: "DOM操作",
        category: "DOM",
        tags: ["dom", "DOM", "querySelector"],
        relevance: 8,
        content: `ScriptCat 脚本中的DOM操作：

选择元素：
- document.querySelector(selector): 选择第一个匹配的元素
- document.querySelectorAll(selector): 选择所有匹配的元素

修改元素：
- element.textContent: 修改文本内容
- element.innerHTML: 修改HTML内容
- element.setAttribute(name, value): 设置属性
- element.style.property: 修改样式

创建元素：
- document.createElement(tag): 创建新元素
- element.appendChild(child): 添加子元素
- element.removeChild(child): 移除子元素

监听事件：
- element.addEventListener(event, handler): 添加事件监听
- element.removeEventListener(event, handler): 移除事件监听

示例：
const button = document.querySelector('button');
if (button) {
  button.addEventListener('click', () => {
    console.log('按钮被点击');
  });
}`,
    },
    {
        id: "element_selection",
        title: "元素选择器",
        category: "DOM",
        tags: ["selector", "选择器", "CSS"],
        relevance: 8,
        content: `常用的CSS选择器：

基本选择器：
- #id: 通过ID选择元素
- .class: 通过类名选择元素
- tag: 通过标签名选择元素
- *: 选择所有元素

组合选择器：
- .class1.class2: 同时拥有多个类
- #id.class: ID和类组合
- tag.class: 标签和类组合

层级选择器：
- parent child: 后代选择器
- parent > child: 子元素选择器
- prev + next: 相邻兄弟选择器
- prev ~ next: 后续兄弟选择器

属性选择器：
- [attr]: 拥有指定属性
- [attr=value]: 属性等于指定值
- [attr^=value]: 属性以指定值开头
- [attr$=value]: 属性以指定值结尾
- [attr*=value]: 属性包含指定值

伪类选择器：
- :hover: 鼠标悬停
- :active: 激活状态
- :first-child: 第一个子元素
- :last-child: 最后一个子元素
- :nth-child(n): 第n个子元素`,
    },
    {
        id: "async_await",
        title: "异步编程",
        category: "异步",
        tags: ["async", "await", "Promise"],
        relevance: 7,
        content: `使用 async/await 处理异步操作：

基本语法：
async function fetchData() {
  try {
    const response = await GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://api.example.com/data'
    });
    console.log(response.responseText);
  } catch (error) {
    console.error('请求失败', error);
  }
}

GM_xmlhttpRequest 的 Promise 封装：
function request(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      onload: resolve,
      onerror: reject
    });
  });
}

使用示例：
async function main() {
  const data = await request('https://api.example.com/data');
  console.log(data);
}`,
    },
    {
        id: "event_listeners",
        title: "事件监听",
        category: "事件",
        tags: ["event", "事件", "addEventListener"],
        relevance: 7,
        content: `常用事件监听：

鼠标事件：
- click: 点击
- dblclick: 双击
- mousedown: 鼠标按下
- mouseup: 鼠标释放
- mousemove: 鼠标移动
- mouseover: 鼠标移入
- mouseout: 鼠标移出

键盘事件：
- keydown: 键盘按下
- keyup: 键盘释放
- keypress: 按键

表单事件：
- submit: 表单提交
- change: 值改变
- input: 输入
- focus: 获得焦点
- blur: 失去焦点

文档事件：
- DOMContentLoaded: DOM加载完成
- load: 页面加载完成
- scroll: 滚动
- resize: 窗口大小改变

示例：
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM已加载');
  const button = document.querySelector('button');
  button?.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('按钮被点击');
  });
});`,
    },
    {
        id: "scriptcat_website",
        title: "ScriptCat官网",
        category: "资源",
        tags: ["官网", "文档", "ScriptCat"],
        relevance: 9,
        content: `ScriptCat 官方资源：

官方网站：https://scriptcat.org/
- 提供最新的版本下载
- 完整的API文档
- 脚本市场
- 使用教程

GitHub仓库：https://github.com/scriptcat/scriptcat
- 源代码
- 问题反馈
- 功能建议
- 贡献代码

文档中心：
- API参考文档
- 开发指南
- 最佳实践
- 常见问题解答

社区支持：
- 官方论坛
- Discord社区
- QQ群
- 微信群`,
    },
    {
        id: "common_issues",
        title: "常见问题",
        category: "FAQ",
        tags: ["faq", "问题", "常见"],
        relevance: 7,
        content: `ScriptCat 常见问题解答：

Q: 脚本没有运行？
A: 检查 @match 或 @include 是否正确匹配当前URL

Q: GM API 报错 undefined？
A: 检查 @grant 是否添加了相应的权限

Q: 如何调试脚本？
A: 打开浏览器开发者工具（F12），在Console中查看日志

Q: 脚本如何自动更新？
A: 使用 @updateURL 和 @downloadURL 指定更新地址

Q: 如何分享脚本？
A: 可以发布到ScriptCat脚本市场或GitHub

Q: 脚本性能如何优化？
A: 避免频繁DOM操作，使用事件委托，合理使用缓存

Q: 如何处理跨域请求？
A: 使用 GM_xmlhttpRequest 并在 @connect 中声明域名

Q: 脚本冲突怎么办？
A: 检查是否有其他脚本修改了相同的元素`,
    },
    {
        id: "value_listener",
        title: "值变化监听",
        category: "存储",
        tags: ["GM_addValueChangeListener", "监听", "存储"],
        relevance: 6,
        content: `GM_addValueChangeListener 用于监听存储值的变化：

GM_addValueChangeListener('key', (name, oldValue, newValue, remote) => {
  console.log('值发生变化');
  console.log('键名:', name);
  console.log('旧值:', oldValue);
  console.log('新值:', newValue);
  console.log('是否来自其他标签页:', remote);
});

参数说明：
- name: 变化的键名
- oldValue: 旧值
- newValue: 新值
- remote: 是否来自其他标签页或窗口

移除监听：
const listenerId = GM_addValueChangeListener('key', callback);
// GM_removeValueChangeListener(listenerId);

应用场景：
- 多标签页同步数据
- 配置变化时更新UI
- 实时响应设置更改`,
    },
    {
        id: "download",
        title: "文件下载",
        category: "网络",
        tags: ["GM_download", "下载", "文件"],
        relevance: 6,
        content: `GM_download 用于下载文件：

GM_download({
  url: 'https://example.com/file.zip',
  name: 'downloaded-file.zip',
  saveAs: true,
  onerror: function(error) {
    console.error('下载失败', error);
  },
  onprogress: function(progress) {
    console.log('下载进度:', progress);
  },
  onload: function() {
    console.log('下载完成');
  }
});

参数说明：
- url: 下载文件的URL（必需）
- name: 保存的文件名（可选）
- saveAs: 是否显示保存对话框（可选）
- onerror: 错误回调（可选）
- onprogress: 进度回调（可选）
- onload: 完成回调（可选）

注意：
- 需要在 @grant 中添加 GM_download 权限
- 支持跨域下载
- 可以下载大文件`,
    },
    {
        id: "clipboard",
        title: "剪贴板操作",
        category: "系统",
        tags: ["GM_setClipboard", "剪贴板", "复制"],
        relevance: 6,
        content: `GM_setClipboard 用于设置剪贴板内容：

GM_setClipboard('要复制的文本');

也可以设置HTML内容：
GM_setClipboard('<b>粗体文本</b>', 'text/html');

参数说明：
- data: 要复制的内容（必需）
- info: 数据类型，默认为 'text/plain'（可选）

支持的数据类型：
- text/plain: 纯文本
- text/html: HTML格式
- image/png: PNG图片

应用场景：
- 一键复制功能
- 格式化文本复制
- 图片复制

注意：
- 需要在 @grant 中添加 GM_clipboard 权限
- 某些浏览器可能需要用户交互才能访问剪贴板`,
    },
];

function searchKnowledgeBase(query: string, maxResults: number = 5): KnowledgeBaseItem[] {
    const lowerQuery = query.toLowerCase();
    const results = SCRIPTCAT_KNOWLEDGE_BASE.map((item) => {
        let score = 0;

        if (item.title.toLowerCase().includes(lowerQuery)) {
            score += 10;
        }
        if (item.content.toLowerCase().includes(lowerQuery)) {
            score += 5;
        }
        if (item.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
            score += 8;
        }
        if (item.category.toLowerCase().includes(lowerQuery)) {
            score += 7;
        }

        score += item.relevance;

        return { ...item, score };
    });

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(({ ...item }) => item);
}

function formatKnowledgeForPrompt(items: KnowledgeBaseItem[]): string {
    if (items.length === 0) {
        return "";
    }

    return `
相关知识库信息：
${items
            .map(
                (item) => `
### ${item.title}
${item.content}
`
            )
            .join("\n")}
`;
}

export { SCRIPTCAT_KNOWLEDGE_BASE, searchKnowledgeBase, formatKnowledgeForPrompt, type KnowledgeBaseItem };
