# 便捷搜索浏览器插件

在搜索结果页快速切换搜索引擎，继续搜索相同关键词；也可以选中文本，通过右键菜单直接搜索。支持在线选择、手动添加和拖拽排序，让常用的搜索入口集中在一起。

[GitHub 仓库][1] · [Releases 下载][3] · [使用指南](https://lemontree.one/docs/quicksearch/) · [Chrome 扩展商店][4] · [Edge 扩展商店][5]

## 功能亮点

- **多引擎切换**：内置 Google、百度、必应和小红书，点击扩展图标即可选择其他引擎，继续搜索当前关键词。
- **在线添加**：从 JSON 列表获取可选引擎，支持按名称、分类或网站搜索，按分类筛选并批量添加，同一搜索网址避免重复添加。
- **手动添加**：填写名称和搜索网址，用 `%s` 代替搜索关键词，支持查询参数和路径形式的网址。
- **拖拽排序**：拖动设置页左侧手柄调整顺序，也可聚焦手柄后按 `Alt + ↑ / ↓`。保存后的顺序同步到弹窗和右键菜单。
- **统一保存**：编辑名称、网址、启用状态或搜索偏好后，点击“保存设置”生效；页面显示未保存、保存成功和失败提示。
- **右键搜索**：选中文本后，从右键菜单选择已启用的引擎，在新标签页打开搜索结果。
- **配置备份**：支持导出和导入 JSON 配置，导入后点击“保存设置”生效。
- **离线备用**：在线列表不可用时，使用上次成功加载的缓存或内置列表；浏览器重启和后台唤醒后按已保存的配置恢复右键菜单。

## 截图

![便捷搜索界面][2]

## 安装

### 扩展商店

- [Chrome 扩展商店][4]
- [Microsoft Edge 扩展商店][5]

### 开发者模式

1. 前往 [GitHub Releases][3] 下载并解压插件压缩包。
2. 打开 Chrome 的 `chrome://extensions` 或 Edge 的 `edge://extensions`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的 `quickSearch` 目录。

本地开发时，也可以直接加载仓库中的 `src` 目录。修改代码后，在扩展管理页点击重新加载。

## 使用与设置

1. 在搜索结果页点击扩展图标，选择搜索引擎，继续搜索相同关键词。
2. 打开“设置”，点击“添加搜索引擎”，搜索并选择需要的引擎；也可点击“手动添加”填写名称和网址。
3. 拖动列表左侧手柄排序，通过开关启用或停用引擎，点击右侧 `×` 移除。
4. 点击底部“保存设置”，将修改应用到搜索列表和右键菜单。

切换搜索引擎默认在当前标签页打开；勾选“在新标签页打开”并保存后，会保留当前页面。右键搜索始终在新标签页打开。

## 自定义搜索

将搜索网址中的关键词替换为 `%s`。例如，把 `https://www.baidu.com/s?wd=便捷搜索` 改为 `https://www.baidu.com/s?wd=%s`，填写名称后保存即可。

以下网址可以通过“手动添加”使用：

| 名称 | 搜索网址 |
| --- | --- |
| 知乎 | `https://www.zhihu.com/search?type=content&q=%s` |
| B站 | `https://search.bilibili.com/all?keyword=%s` |
| 微博 | `https://s.weibo.com/weibo?q=%s` |
| 抖音 | `https://www.douyin.com/search/%s` |
| 小红书 | `https://www.xiaohongshu.com/search_result?keyword=%s&type=51` |
| GitHub | `https://github.com/search?q=%s&type=repositories` |
| 豆瓣 | `https://www.douban.com/search?q=%s` |
| 淘宝 | `https://s.taobao.com/search?page=1&q=%s&tab=all` |
| 京东 | `https://search.jd.com/Search?enc=utf-8&keyword=%s` |
| 搜狗微信 | `https://weixin.sogou.com/weixin?type=2&query=%s` |
| X | `https://x.com/search?q=%s&src=typed_query` |
| X by Google | `https://www.google.com/search?q=site%3Ax.com+%s` |
| YouTube | `https://www.youtube.com/results?search_query=%s` |

## 搜索引擎列表维护

“添加搜索引擎”会查询在线 JSON 列表，支持名称/网站搜索、分类筛选和批量添加；也可手动填写。添加后仍需点击“保存设置”。已添加的引擎按搜索网址去重，在线列表不会自动覆盖用户配置。

统一编辑 `src/data/search-engines.json`，格式如下：

```json
{
  "version": 1,
  "engines": [
    {
      "id": "zhihu",
      "name": "知乎",
      "category": "社区内容",
      "url": "https://www.zhihu.com/search?type=content&q=%s"
    }
  ]
}
```

`id` 和搜索网址须唯一，网址须使用 HTTP/HTTPS 并包含 `%s`。`category` 为可选分类。

将 `src/data/search-engines.json` 上传到服务器的 `/static/json/` 目录，保留文件名 `search-engines.json`。插件从 `https://lemontree.one/static/json/search-engines.json` 查询列表，无需单独运行后端服务。后续编辑 JSON 并覆盖服务器上的同名文件，即可更新可选项，无需发布新版插件。服务器应允许匿名读取该文件；如使用 CDN，请在覆盖文件后刷新该文件的缓存。

如需更换服务地址，调整 `src/js/catalog.js` 的 `endpoint()`。在线列表不可用时，插件依次使用上次成功查询的缓存、扩展内置的同一份 JSON。开发时可点击“刷新列表”重新查询。

## 本地打包

在仓库根目录执行：

```sh
cd build
sh build.sh
```

生成的扩展目录为 `dist/quickSearch`，安装包为 `dist/quickSearch.zip`。

扩展版本统一在 `src/manifest.json` 的 `version` 字段维护，设置页底部自动读取该版本号。

## 开源协议

本项目采用 [MIT License](LICENSE) 开源。

## 更新日志

### v1.0.5

**2026.10.8**

- 搜索引擎支持拖拽排序，保存后的顺序同步到弹窗和右键菜单。
- 添加搜索引擎时支持在线搜索、分类筛选和批量添加，并保留手动添加入口。
- 在线搜索引擎列表通过 JSON 文件维护，加载失败时使用缓存或内置列表。
- 优化设置界面，增加“保存设置”按钮和保存状态提示，精简页面文案。
- 修复修改搜索引擎后，浏览器重启或后台唤醒时右键菜单失效的问题，兼容旧配置中的空项。
- 设置页新增 GitHub 仓库入口，完善使用和配置维护说明。
- 采用 MIT 协议开源。

### v1.0.4
**2025.8.10**

- 右键搜索使用新标签页打开
- 切换搜索引擎默认当前标签页
- 内置搜狗搜索改为小红书
- 备份恢复改为导出导入

### v1.0.3
**2025.8.7**
- 适配 Chrome Manifest V3
- 优化设置界面
- 优化切换样式

### v1.0.2
**2023.11.9**

修复右键搜索失效问题

### v1.0.1
**2022.12.22**

1、支持新标签页打开搜索结果

2、修复右键搜索已知问题

3、更新使用文档、建议反馈入口

[1]: https://github.com/lemon-codehub/SearchCrutch
[2]: https://lemontree.one/docs/quicksearch/assets/cover.51IW7ySK.jpg
[3]: https://github.com/lemon-codehub/SearchCrutch/releases
[4]: https://chromewebstore.google.com/detail/%E4%BE%BF%E6%8D%B7%E6%90%9C%E7%B4%A2/oldegmeclddhhdpeaedkbfphghkmhnid
[5]: https://microsoftedge.microsoft.com/addons/detail/mpobbihlicncajephnnbcdjmgfinplpf
