# 便捷搜索浏览器插件
一键切换多引擎，关键词无需重输，极致高效的浏览器搜索体验

## 功能亮点

- 🚀 **多引擎切换**：支持 Google、百度、必应等主流搜索引擎，点击即可切换，无需重复输入关键词
- 🛠️ **自定义引擎**：可自定义添加任意搜索引擎，满足个性化需求
- 🖱️ **右键搜索**：选中文本，右键菜单选择搜索引擎搜索


## 安装教程

- 应用商店安装

[Chrome应用商店安装链接][4]

- 开发者模式安装

下载插件压缩包，在Chrome扩展开启开发者模式后，点击加载已解压的扩展程序选择项目的文件夹即可安装成功

[直链下载](https://lemontree.one/files/crx/quickSearch.zip)

[网盘下载](https://www.123684.com/s/y4HrVv-MztlA)


## 自定义搜索
插件已经内置了部分搜索引擎，自定义搜索引擎将搜索关键词替换为%s即可。以下表格汇总的一些常见的搜索URL

名称|URL
-|-
知乎|https://www.zhihu.com/search?type=content&q=%s  
B站|https://search.bilibili.com/all?keyword=%s
微博|https://s.weibo.com/weibo?q=%s
抖音|https://www.douyin.com/search/%s
小红书|https://www.xiaohongshu.com/search_result?keyword=%s&type=51
Github|https://github.com/search?q=%s&type=repositories
豆瓣|https://www.douban.com/search?q=%s
淘宝|https://s.taobao.com/search?page=1&q=%s&tab=all
京东|https://search.jd.com/Search?enc=utf-8&keyword=%s
搜狗微信|https://weixin.sogou.com/weixin?type=2&query=%s
X |https://x.com/search?q=%s&src=typed_query
X by Google|https://www.google.com/search?q=site%3Ax.com+%s
Youtube|https://www.youtube.com/results?search_query=%s


**导入搜索引擎**

下载 [json 文件](https://lemontree.one/docs/quicksearch/search_list.json)在设置点击恢复数据选文件可导入以上搜索引擎



## 截图
![][2]

## 视频演示

<iframe width="100%" height="480px" src="https://www.youtube.com/embed/pE7IEA4xJAk?si=6jT0s_b6H2v8Wlqi" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

## 数据安全

1. 信息收集
本插件不会主动收集、存储或上传任何个人身份信息。插件的所有设置、搜索引擎自定义数据等仅保存在您的本地浏览器或通过 Chrome 同步机制在您的设备间同步，不会上传到任何第三方服务器。

2. 数据使用
插件仅在本地存储您的自定义设置和搜索引擎列表，用于实现插件功能。
插件不会分析、存储或上传您的搜索内容、浏览历史或任何网页数据。
插件不会向第三方提供、出售或共享您的任何信息。

3. 权限说明
插件请求的权限仅用于实现如下功能：
读取和修改浏览器标签页（用于切换搜索引擎）。
存储插件设置（用于保存您的自定义配置）。
右键菜单功能（用于快速搜索选中文本）。
插件不会滥用任何权限。

4. 第三方服务
本插件不集成任何第三方统计、广告或追踪服务。

## 更新日志
## v1.0.4
**2025.8.10**

- 右键搜索使用新标签页打
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



  [1]: https://github.com/xhhjin/SearchCrutch
  [2]: /cover.jpg
  [4]: https://chromewebstore.google.com/detail/%E4%BE%BF%E6%8D%B7%E6%90%9C%E7%B4%A2/oldegmeclddhhdpeaedkbfphghkmhnid